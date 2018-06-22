/**
 * The main module for Harmony Hub related stuff
 *
 * @module HarmonyHub
 */

/**
 *
 */
import * as Debug from 'debug'
import { createHarmonyClient, buildCommandIqStanza } from './harmony-xmpp'

import {
	HarmonyClientFactory,
	IHarmonyHubConnection,
	IHarmonyClient,
} from './harmony.types'

import { decodeResponse, IHarmonyRequest } from './harmony-utils'

import {
	Observable,
	Observer,
	Subscription,
	SubscriptionLike,
	fromEvent,
	ReplaySubject,
	interval,
} from 'rxjs'

import {
	mergeMap,
	map,
	tap,
	take,
	delay,
	filter,
	multicast,
	refCount,
} from 'rxjs/operators'

/**
 * @hidden
 */
const debug = Debug('rxharmony:hub')

export enum ActivityStatus {
	Off = 0,
	Starting = 1,
	Running = 2,
	Stopping = 3,
}

/**
 * event of the hub e.g. in case of activity switching
 */
export interface IHubDigest {
	sleepTimerId: number
	runningZoneList: any[]
	configVersion: number
	activityId: string
	syncStatus: number
	time: number
	stateVersion: number
	tzOffset: string
	mode: number
	hubSwVersion: string
	deviceSetupState: any[]
	tzoffset: string
	isSetupComplete: boolean
	contentVersion: number
	wifiStatus: number
	discoveryServer: string
	activityStatus: ActivityStatus
	runningActivityList: string
	tz: string
	activitySetupState: boolean
	updates: object
	hubUpdate: boolean
	sequence: boolean
	accountId: string
}
export interface IHubEvent extends IHubDigest {
	friendlyName?: string
	activityLabel: string
	runningActivityListLabel: string
}
/**
 * harmony hubs configuration information when retrieving
 * config from hub
 */
export interface IHarmonyConfig {
	activity: IHarmonyActivity[]
	device: IHarmonyDevice[]

	content: any
	global: {
		timeStampHash: string
		locale: string
	}
}

export interface IHarmonyDevice {
	Transport: number
	suggestedDisplay: string
	deviceTypeDisplayName: string
	label: string
	id: string
	Capabilities: number[]
	type: string
	DongleRFID: number
	controlGroup: IHarmonyControl[]
}

export interface IHarmonyControl {
	name: string
	function: IHarmonyFunction[]
}

export type IHarmonyAction = string
export interface IHarmonyFunction {
	action: IHarmonyAction
	name: string
	label: string
}
export interface IHarmonyActivity {
	type: 'string'
	isAVActivity: boolean
	label: string
	id: string
	activityTypeDisplayName: string
	controlGroup: IHarmonyControl[]
	sequences: any[]
	fixit: {
		[id: string]: { id: string; [name: string]: any }
	}
	rules: any[]
	icon: string
	suggestedDisplay: string
	isTuningDefault?: false
	KeyboardTextEntryActivityRole?: string
	baseImageUri?: string
	zones: any
	activityOrder: number
	isMultiZone?: false
}
/**
 * The main class for managing a harmony hub
 */
export class HarmonyHub implements SubscriptionLike {
	protected _client$: Observable<IHarmonyClient>
	protected _keepAliveSubscription: Subscription

	protected _config: IHarmonyConfig
	protected _activities: Map<string, IHarmonyActivity> = new Map()
	protected _currentActivity: IHarmonyActivity

	protected _stopClient: () => void

	protected set config(conf: IHarmonyConfig) {
		this._config = conf

		this._activities = new Map()
		conf.activity.forEach((activity: IHarmonyActivity) => {
			this._activities.set(activity.id, activity)
			this._activities.set(activity.label.toLowerCase(), activity)
		})
	}

	get closed(): boolean {
		return !!this._keepAliveSubscription || !!this._stopClient
	}

	public static create(ip: string) {
		return new HarmonyHub(ip)
	}

	constructor(
		public url: string,
		keepAlive: number = 5,
		protected _clientFactory: HarmonyClientFactory = createHarmonyClient
	) {
		this._client$ = new Observable((obs: Observer<IHarmonyClient>) => {
			let client
			debug('creating client')
			this._clientFactory(url)
				.then((connection: IHarmonyHubConnection) => {
					client = connection.client
					client.on('error', obs.error.bind(obs))
					obs.next(client)
				})
				.catch(e => obs.error(e))

			this._stopClient = obs.complete.bind(obs)

			return () => {
				debug('Disconnecting from hub')
				if (client) {
					client.removeAllListeners()
					client.end()
				}
			}
		}).pipe(
			tap(() => this.getConfig()),
			tap(() => this.getCurrentActivity()),
			multicast(() => new ReplaySubject<IHarmonyClient>(1)),
			refCount()
		)

		if (keepAlive > 0) {
			this._keepAliveSubscription = this._client$
				.pipe(
					mergeMap(() => this.getCurrentActivity()),
					mergeMap(() => interval(keepAlive * 1000)),
					mergeMap(() => this.getCurrentActivity())
				)
				.subscribe(activity => debug('Ping'))
		}
	}

	public resolveActivity(idOrLabel: string) {
		return this._activities.get(idOrLabel.toLowerCase())
	}

	public getLabel(activityId: string): string {
		const activity = this._activities.get(activityId.toLowerCase())
		return activity ? activity.label : undefined
	}

	public observe(): Observable<IHubEvent> {
		return this._client$.pipe(
			tap(() => this.getConfig()),
			mergeMap((client: IHarmonyClient) => fromEvent(client, 'stanza')),
			map((stanza: any) => stanza.getChild('event')),
			filter((event: any) => {
				if (event) {
					const type = event.attr('type')
					debug('Event occurred', type)
					return type === 'connect.stateDigest?notify'
				}
				return false
			}),
			map((event: any) => JSON.parse(event.getText())),
			map((event: IHubEvent) => {
				event.activityLabel = this.getLabel(event.activityId)
				event.runningActivityListLabel = this.getLabel(
					event.runningActivityList
				)

				return event
			})
		)
	}

	public getConfig(): Promise<IHarmonyConfig> {
		debug('retrieve config')

		return this.request('config').then((config: IHarmonyConfig) => {
			debug(
				'config retrieved %s activities %s devices',
				config.activity.length,
				config.device.length
			)
			this.config = config
			return this.getCurrentActivity().then(() => config)
		})
	}

	public getCurrentActivity(): Promise<IHarmonyActivity> {
		debug('retrieve current activity')
		return this.request('getCurrentActivity').then(result => {
			const activity = this.resolveActivity(result.result)
			this._currentActivity = activity
			return activity
		})
	}

	public startActivity(activityId: string) {
		const timestamp = new Date().getTime()
		const body = {
			activityId,
			timestamp,
		}

		return this.request('startactivity', body)
	}

	public send(command: string, body?: IHarmonyRequest): Promise<any> {
		debug('send  command "' + command + '" with body ', body)
		const iq = buildCommandIqStanza(command, body)

		return this._client$
			.pipe(
				map((client: IHarmonyClient) => client.send(iq)),
				take(1)
			)
			.toPromise()
	}

	public request(command: string, body?: IHarmonyRequest): Promise<any> {
		debug('request with command "' + command + '" with body ', body)

		const iq = buildCommandIqStanza(command, body)
		const id = iq.attr('id')

		return this._client$
			.pipe(
				mergeMap((client: IHarmonyClient) => {
					client.send(iq)
					return fromEvent(client, 'stanza')
				}),
				filter((retStanza: any) => {
					const gotId = retStanza.attr('id')

					return gotId === id
				}),
				// timeout(30000),

				map((stanza: any) => {
					const data = stanza.getChildText('oa')
					try {
						const ret = JSON.parse(data)
						debug('stanza with JSON', data)
						return ret
					} catch (e) {
						debug('stanza with data', data)
						return decodeResponse(data)
					}
				}),
				take(1)
			)
			.toPromise()
	}

	public async press(key: string, durationInMs: number = 50): Promise<any> {
		if (!this._currentActivity) {
			throw new Error('Current activity not known')
		}
		return this._client$
			.pipe(
				map(() => {
					debug('Getting %s for activity', key, this._currentActivity)
					const controls = this._currentActivity.controlGroup
					let action: IHarmonyFunction = null
					controls.find(ctrl => {
						action = ctrl.function.find(func => func.name === key)
						return action !== undefined
					})
					if (!action) {
						throw new Error(
							`${key} not known in activity ${
								this._currentActivity.label
							}`
						)
					}
					return action
				}),
				mergeMap(action =>
					this.send('holdAction', {
						status: 'press',
						timestamp: 0,
						verb: 'render',
						action: action.action,
					}).then(() => action)
				),
				delay(durationInMs),
				mergeMap(action =>
					this.send('holdAction', {
						status: 'release',
						timestamp: durationInMs,
						action: action.action,
					})
				),
				take(1)
			)
			.toPromise()
	}

	public unsubscribe() {
		if (this._keepAliveSubscription) {
			debug('Unsubscribing keepalive')
			this._keepAliveSubscription.unsubscribe()
		}

		if (this._stopClient) {
			debug('Stopping client')
			this._stopClient()
		}
	}
}
