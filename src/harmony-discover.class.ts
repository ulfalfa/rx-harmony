/**
 * Module for discovery of hubs
 *
 * usage is the scanning of a network with udp broadcasts
 *
 * @module HarmonyDiscover
 */

/**
 *
 */
import * as Debug from 'debug';
const debug = Debug('rxharmony:discover');

import {
    Observable,
    SubscriptionLike,
    Subscription,
    Subject,
    interval,
    using,
} from 'rxjs';

import { tap } from 'rxjs/operators';

import { createSocket, Socket } from 'dgram';
import { createServer, Server, Socket as NetSocket } from 'net';

export interface IDiscoverOptions {
    netmask?: string; // 255.255.255.255
    serverPort?: number; // 67834
    port?: number; // 5224
    interval?: number; // 1000
}

/**
 * returned when discovered via bonjour/udp4
 *
 * the state and lastseen information is added by HarmonyHubDiscover
 * to indicate if a hub left and entered network
 */
export interface IDiscoverDigest {
    friendlyName: string;
    ip: string;
    host_name: string;
    email: string;
    mode: string;
    accountId: string;
    port: string;
    uuid: string;
    current_fw_version: string;
    productId: string;
    setupSessionType: string;
    setupSessionClient: string;
    setupSessionIsStale: string;
    setupSessionSetupType: string;
    setupStatus: string;
    discoveryServerUri: string;
    openApiVersion: string;
    minimumOpenApiClientVersionRequired: string;
    recommendedOpenApiClientVersion: string;
    hubProfiles: string;
    remoteId: string;
    oohEnabled: string;
    state: HarmonyHubState;
    lastSeen: Date;
    protocolVersion: string;
    hubId: string;
}

export enum HarmonyHubState {
    Offline,
    Online,
}

const ANNOUNCE = '_logitech-reverse-bonjour._tcp.local.\n';

const EXPIRE_EVERY = 2;

function decodeResponse(response: string): IDiscoverDigest {
    const info = {};

    response.split(';').forEach(function(keyValue) {
        const [key, value] = keyValue.split(':');
        info[key] = value;
    });

    info['lastSeen'] = new Date();
    info['state'] = HarmonyHubState.Online;

    return <IDiscoverDigest>info;
}

export class HarmonyDiscover implements SubscriptionLike {
    public get closed(): boolean {
        return false;
    }

    protected _server: Server;
    protected _socket: Socket;
    protected _msgBuffer: Buffer;

    protected _ping: Subscription;

    protected _hubInfo$: Subject<IDiscoverDigest> = new Subject<
        IDiscoverDigest
    >();

    protected _hubs: Map<string, IDiscoverDigest> = new Map<
        string,
        IDiscoverDigest
    >();

    public static observe(
        _opts?: IDiscoverOptions
    ): Observable<IDiscoverDigest> {
        return using(
            () => new HarmonyDiscover(_opts),
            (discover: HarmonyDiscover) => {
                return discover.observe();
            }
        );
    }

    constructor(protected _opts: IDiscoverOptions = {}) {
        debug('Creating server');

        this._opts = Object.assign(
            {},
            {
                netmask: '255.255.255.255',
                serverPort: 61234,
                port: 5224,
                interval: 5000,
            },
            this._opts
        );

        this._server = createServer((socket: NetSocket) => {
            let buffer = '';

            socket.on('data', data => {
                debug('received data chunk');
                buffer += data.toString();
            });

            socket.on('end', () => {
                debug('connection closed. emitting data.', buffer);
                const hubInfo = decodeResponse(buffer.toString());
                const storedHub = this._hubs.get(hubInfo.uuid);
                if (
                    hubInfo &&
                    (!storedHub || storedHub.state === HarmonyHubState.Offline)
                ) {
                    this._hubInfo$.next(hubInfo);
                }
                this._hubs.set(hubInfo.uuid, hubInfo);
            });
        });
    }

    public observe(): Observable<IDiscoverDigest> {
        this._server.listen(this._opts.serverPort);
        debug(
            'Starting server at',
            this._server.address(),
            this._opts.serverPort
        );
        debug('creating socket');
        this._socket = createSocket('udp4');
        this._msgBuffer = new Buffer(ANNOUNCE + this._opts.serverPort);
        this._socket.bind(this._opts.port, () => {
            debug('binding socket and setting broadcast');
            this._socket.setBroadcast(true);
        });

        this._ping = interval(this._opts.interval)
            .pipe(
                tap(() => {
                    debug('Ping at %s:%d', this._opts.netmask, this._opts.port);

                    this._socket.send(
                        this._msgBuffer,
                        0,
                        this._msgBuffer.length,
                        this._opts.port,
                        this._opts.netmask,
                        err => {
                            if (err) {
                                debug('Errorhandler', err);
                                this._hubInfo$.error(err);
                            }
                        }
                    );
                })
            )
            .subscribe(count => {
                if ((count + 1) % EXPIRE_EVERY === 0) {
                    debug('Do clean up');
                    const expired =
                        new Date().valueOf() -
                        EXPIRE_EVERY * this._opts.interval;
                    this._hubs.forEach((info: IDiscoverDigest) => {
                        if (
                            info.state === HarmonyHubState.Online &&
                            info.lastSeen.valueOf() < expired
                        ) {
                            debug('Expiring', info.friendlyName);
                            info.state = HarmonyHubState.Offline;
                            this._hubInfo$.next(info);
                        }
                    });
                }
            });
        return this._hubInfo$;
    }

    public unsubscribe() {
        debug('Closing server and socket');
        if (this._ping) {
            this._ping.unsubscribe();
        }
        this._server.close();

        this._socket.close();
    }
}
