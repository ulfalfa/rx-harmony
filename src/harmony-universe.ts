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

import { switchMap, mergeMap, map, groupBy, filter } from 'rxjs/operators';

import { HarmonyHub, ActivityStatus, IHubEvent } from './harmony-hub.class';
import {
    HarmonyDiscover,
    IDiscoverDigest,
    IDiscoverOptions,
    HarmonyHubState,
} from './harmony-discover.class';

export interface IHarmonySimpleStatus {
    label: string;
    active: boolean;
    friendlyName: string;
}
export namespace HarmonyOperators {
    export function humanizeStatus(): OperatorFunction<
        IHubEvent,
        IHarmonySimpleStatus
    > {
        return (
            source: Observable<IHubEvent>
        ): Observable<IHarmonySimpleStatus> => {
            return source.pipe(
                filter(
                    event =>
                        !(
                            (event.activityStatus === ActivityStatus.Off &&
                                event.runningActivityList) ||
                            (event.activityStatus === ActivityStatus.Running &&
                                event.runningActivityListLabel ===
                                    event.activityLabel)
                        )
                ),
                map((event: IHubEvent) => {
                    const r = {
                        active: true,
                        label: '',
                        friendlyName: event.friendlyName,
                    };
                    switch (event.activityStatus) {
                        case ActivityStatus.Off:
                            r.active = true;
                            r.label = event.activityLabel;
                            break;
                        case ActivityStatus.Starting:
                            r.active = false;
                            r.label =
                                event.runningActivityListLabel || 'PowerOff';
                            break;
                        case ActivityStatus.Running:
                            r.active = true;
                            r.label = event.activityLabel;
                            break;
                        case ActivityStatus.Stopping:
                            r.active = false;
                            r.label = event.activityLabel;
                    }
                    return r;
                })
            );
        };
    }

    export function observeDiscoveredHubs(
        on?: (info: IDiscoverDigest, hub: HarmonyHub) => void
    ): OperatorFunction<IDiscoverDigest, IHubEvent> {
        return (source: Observable<IDiscoverDigest>): Observable<IHubEvent> => {
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
                                                event.friendlyName =
                                                    info.friendlyName;
                                                return event;
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
): Observable<IHubEvent> {
    return HarmonyDiscover.observe(opts).pipe(
        HarmonyOperators.observeDiscoveredHubs(on)
    );
}
