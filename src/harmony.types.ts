/**
 * Collection of types that are neither discovery nor hub stuf
 *
 * @module HarmonyTypes
 */

/**
 *
 */
import { URL } from 'url';
import { EventEmitter } from 'events';

/**
 * minimum info about a hub - it has a name and url
 * and finally also the client interface (currently xmpp)
 * e.g. xmpp://172.123.123.123:5222
 */
export interface IHarmonyHubConnection {
    friendlyName: string;
    url: URL;
    client: IHarmonyClient;
}

export type HarmonyClientFactory = (
    url: string
) => Promise<IHarmonyHubConnection>;

/**
 * minimum interface a network client must provide
 * for usage in HarmonyHub. Returned by clientFactory
 *
 */
export interface IHarmonyClient extends EventEmitter {
    send: (data: any) => void;
    end: () => Promise<void>;
}

/**
 * returned by the first login to the hub when retrieving
 * the identitiy to logon with
 */
export interface IHarmonyHubInfo {
    friendlyName: string;
    identity: string;
    serverIdentity?: string;
    status?: string;
    hubProfiles?: { [profileName: string]: any };
    productId?: string;
    protocolVersion?: string;
    hubId?: string;
}

