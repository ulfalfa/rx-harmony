/**
 * Module for multiple utilities
 *
 * @module Utilities
 */

/**
 *
 */
import * as Debug from 'debug'

/**
 *
 */
const debug = Debug('rxharmony:utils')

/**
 *
 */
export interface IHarmonyResponse {
    [prop: string]: any
}

import * as JSON5 from 'json5'

export type IHarmonyRequest = IHarmonyResponse

export function decodeResponse(response: string): IHarmonyResponse {
    const REGEX = /([a-zA-Z]+)(?:=)([^:]+)/g
    const SUBEXP = /^{.*}$/
    const result: IHarmonyResponse = {}
    let matches
    while ((matches = REGEX.exec(response))) {
        const [_, key, value] = matches
        if (SUBEXP.test(value)) {
            try {
                debug('Parsing', value.replace('=', ':'))
                result[key] = JSON5.parse(value.replace(/=/g, ':'))
            } catch (e) {
                debug('Error', e)
                result[key] = value
            }
        } else {
            result[key] = value
        }
    }
    return Object.keys(result).length ? result : undefined
}

export function encodeRequest(request: IHarmonyRequest): string {
    debug('decode request', request)
    return Object.keys(request)
        .map((key: string) => {
            let value = request[key]
            switch (typeof value) {
                case 'string':
                    // escape colons
                    value = value.replace(/:{1}(?=[^:])/g, '::')
                    return `${key}=${value}`

                case 'object':
                    return encodeRequest(value)

                default:
                    return `${key}=${value}`
            }
        })
        .join(':')
}
