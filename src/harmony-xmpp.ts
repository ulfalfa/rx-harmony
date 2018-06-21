/**
 * All the XMPP Stuff and communication with a hub
 *
 * @module XMPPConnection
 */

/**
 *
 */ import * as Debug from 'debug';
import { URL } from 'url';
const debug = Debug('rxharmony:xmpp');

import * as xmpp from 'node-xmpp-client';
import { IQ } from '@xmpp/xml';

const JID = 'guest@x.com/gatorade';
const PASSWORD = 'guest';

import {
    IHarmonyHubConnection,
    IHarmonyClient,
    IHarmonyHubInfo,
} from './harmony.types';

import { encodeRequest, decodeResponse, IHarmonyRequest } from './harmony-utils';

export function getUniqueId(): string {
    return Math.floor(Math.random() * 1000000).toString();
}

function buildIqStanza(type, xmlns, mime, body, from?) {
    const iq = new IQ({
        type: type,
        id: getUniqueId(),
        from: from,
    });

    iq.c('oa', {
        xmlns: xmlns,
        mime: mime,
    }).t(body);

    return iq;
}

export function buildCommandIqStanza(command, body: IHarmonyRequest = {}) {
    const encoded = encodeRequest(body);
    debug(
        'buildCommandIqStanza for command "' + command + '" with body ',
        encoded
    );
    return buildIqStanza(
        'get',
        'connect.logitech.com',
        'vnd.logitech.harmony/vnd.logitech.harmony.engine?' + command,
        encoded
    );
}

export function pairHub(url: URL): Promise<IHarmonyHubInfo> {
    debug('Pairing hub @', url.toString());

    const xmppClient = new xmpp({
        jid: JID,
        password: PASSWORD,
        host: url.hostname,
        port: url.port,
        disallowTLS: true,
        reconnect: false,
    });

    let iqId;
    const retPromise: Promise<IHarmonyHubInfo> = new Promise(
        (resolve, reject) => {
            xmppClient.once('online', id => {
                debug('XMPP client online', id._resource);
                const iq = buildIqStanza(
                    'get',
                    'connect.logitech.com',
                    'vnd.logitech.connect/vnd.logitech.pair',
                    'method=pair:name=rxharmony#iOS6.0.1#iPhone',
                    'guest'
                );

                iqId = iq.attr('id');
                xmppClient.send(iq);
            });

            xmppClient.on('error', function(e) {
                debug('XMPP client error', e);
                reject(e);
            });

            xmppClient.on('stanza', stanza => {
                debug('Stanza received');
                debug('Stanza received', stanza.toString());
                debug('Response id', stanza.attrs.id, iqId);
                if (stanza.attrs.id === iqId.toString()) {
                    const body = stanza.getChildText('oa');
                    const response = decodeResponse(body);

                    debug('Response', response);

                    if (response && response.identity) {
                        debug('received identity token: ' + response.ident);
                        xmppClient.end();
                        resolve(<IHarmonyHubInfo>response);
                    } else {
                        debug('could not find identity token');
                        xmppClient.end();
                        reject(new Error('Did not retrieve identity.'));
                    }
                }
            });
        }
    );

    return retPromise;
}

export function loginWithIdentity(
    url: URL,
    info: IHarmonyHubInfo
): Promise<IHarmonyHubConnection> {
    debug(
        'create xmpp client using retrieved identity token %s at %s for ',
        info.identity,
        url,
        info.friendlyName
    );

    const xmppClient: IHarmonyClient = new xmpp({
        jid: info.identity + '@connect.logitech.com/gatorade',
        password: info.identity,
        host: url.hostname,
        port: url.port,
        disallowTLS: true,
        reconnect: true,
    });
    return new Promise((resolve, reject) => {
        xmppClient.once('online', () => {
            debug('XMPP client successfully connected');
            xmppClient.removeAllListeners();

            resolve({
                friendlyName: info.friendlyName,
                url,
                client: xmppClient,
            });
        });

        xmppClient.once('error', reject);
    });
}

export function createHarmonyClient(
    uri: string
): Promise<IHarmonyHubConnection> {
    const url = new URL(uri);
    return pairHub(url).then(info => loginWithIdentity(url, info));
}

/***

Format 1 (->HUB): key1=value1:key2=value2
Format 2 (-> HUB) a value of format 1 could be {"key"::"value","key"::"value","command"::"VolumeDown"}
Format 3 (-> discover HUB) format 1 with a value {key="value", key="value"}





    <iq type="get" id="5e518d07-bcc2-4634-ba3d-c20f338d8927-2">
  <oa xmlns="connect.logitech.com" mime="vnd.logitech.harmony/vnd.logitech.harmony.engine?holdAction">
    action={"type"::"IRCommand","deviceId"::"11586428","command"::"VolumeDown"}:status=press
  </oa>
</iq>

<iq type="get" id="2320426445" from="e01b88af-b4cd-4d1c-8e76-85562ea3fad5">
  <oa xmlns="connect.logitech.com" mime="vnd.logitech.harmony/vnd.logitech.harmony.engine?config">
  </oa>
</iq>

<iq type="get" id="3174962747" from="guest">
  <oa xmlns="connect.logitech.com" mime="vnd.logitech.connect/vnd.logitech.pair">
    token=y6jZtSuYYOoQ2XXiU9cYovqtT+cCbcyjhWqGbhQsLV/mWi4dJVglFEBGpm08OjCW:name=1vm7ATw/tN6HXGpQcCs/A5MkuvI#iOS6.0.1#iPhone
  </oa>
</iq>

<message from="HarmonyOne_Pop@qa1.com" to="ab903454-7bee-4410-9eea-bb5355bb667e" xmlns:stream="http://etherx.jabber.org/streams">
<event xmlns="connect.logitech.com" type="vnd.logitech.control/vnd.logitech.button?pressType">type=short</event></message>
***/
