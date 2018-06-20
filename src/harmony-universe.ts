/**
 * Module for obvserving multiple harmonies in the network and
 * combines [[HarmonyDiscover]] and [[HarmonyHub]
 *
 * usage is the scanning of a network with udp broadcasts
 *
 * @module HarmonyUniverse
 */

import * as Debug from 'debug';

/**
 *
 */
const debug = Debug('rxharmony:universe');

import {
    Observable,
    using,
    OperatorFunction,
    never,
} from 'rxjs';

import { switchMap, mergeMap, map, groupBy } from 'rxjs/operators';

import { HarmonyHub } from './harmony-hub.class';
import {
    HarmonyDiscover,
    IDiscoverDigest,
    IDiscoverOptions,
    HarmonyHubState,
} from './harmony-discover.class';

export interface IHarmonyEvent {
    friendlyName: string;
    id: string;
    label: string;
    status: number;
    from: string;
    fromLabel: string;
}
export namespace HarmonyOperators {
    export function observeDiscoveredHubs(
        on?: (info: IDiscoverDigest, hub: HarmonyHub) => void
    ): OperatorFunction<IDiscoverDigest, IHarmonyEvent> {
        return (
            source: Observable<IDiscoverDigest>
        ): Observable<IHarmonyEvent> => {
            return source.pipe(
                groupBy(info => info.ip),
                mergeMap((infoByIp: Observable<IDiscoverDigest>) => {
                    return infoByIp.pipe(
                        switchMap((info: IDiscoverDigest) => {
                            debug(
                                'Detecting HarmonyHub %s(%s) is %s',
                                info.friendlyName,
                                info.ip,
                                info.state
                            );
                            if (info.state === HarmonyHubState.Online) {
                                return using(
                                    () => {
                                        const hub = HarmonyHub.create(
                                            'xmpp://' + info.ip
                                        );
                                        if (on) {
                                            on(info, hub);
                                        }
                                        return hub;
                                    },
                                    (hub: HarmonyHub) => {
                                        return hub.observe().pipe(
                                            map(event => {
                                                const activity = hub.resolveActivity(
                                                    event.activityId
                                                );
                                                const from = hub.resolveActivity(
                                                    event.runningActivityList
                                                );
                                                return {
                                                    friendlyName:
                                                        info.friendlyName,
                                                    id: event.activityId,
                                                    label: activity.label,
                                                    status:
                                                        event.activityStatus,
                                                    from:
                                                        event.runningActivityList,
                                                    fromLabel: from
                                                        ? from.label
                                                        : undefined,
                                                };
                                            })
                                        );
                                    }
                                );
                            } else {
                                if (on) {
                                    on(info, null);
                                }
                                return never();
                            }
                        })
                    );
                })
            );
        };
    }
}

export function observeAll(
    on?: (info: IDiscoverDigest, hub: HarmonyHub) => void,
    opts?: IDiscoverOptions
) {
    return HarmonyDiscover.observe(opts).pipe(
        HarmonyOperators.observeDiscoveredHubs(on)
    );
}
