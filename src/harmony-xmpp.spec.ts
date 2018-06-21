import { serial, TestInterface } from 'ava'

import * as td from 'testdouble'
import * as lolex from 'lolex'
import { Clock } from 'lolex'

import * as Debug from 'debug'

const debug = Debug('rxharmony:test')

const test = serial as TestInterface<Context>

const xmpp = td.replace('node-xmpp-client')

import { URL } from 'url'

import {
    createHarmonyClient,
    loginWithIdentity,
    pairHub,
    buildCommandIqStanza,
} from './harmony-xmpp'

import { encodeRequest } from './harmony-utils'

import { IHarmonyHubConnection, IHarmonyClient } from './harmony.types'

import { IQ } from '@xmpp/xml'

const myHarmony = 'xmpp://192.168.168.168:5222'

interface Context {
    clock: Clock
    xmpp: IHarmonyClient
}

test.beforeEach(t => {
    t.context = {
        clock: lolex.install(),
        xmpp,
    }
})

test('Checking pairHub throwing on error', t => {
    td.when(xmpp.prototype.on('error')).thenCallback(new Error('test'))

    return pairHub(new URL(myHarmony))
        .then((client: any) => {
            t.fail()
        })
        .catch(e => {
            t.is(e.message, 'test')
        })
})

test('Checking pairHub emitting', t => {
    td.reset()

    const retStanza = new IQ({
        id: 1,
    })

    retStanza
        .c('oa', {})
        .t(encodeRequest({ identity: 'testid', friendlyName: 'Testhub' }))

    td.when(xmpp.prototype.once('online')).thenCallback({ _resource: 'test' })
    td.when(xmpp.prototype.send(td.matchers.anything())).thenDo(x => {
        debug('Id received', x.attrs.id)
        retStanza.attrs.id = x.attrs.id
    })
    td.when(xmpp.prototype.on('stanza')).thenCallback(retStanza)

    const result = pairHub(new URL(myHarmony)).then((id: any) => {
        t.deepEqual(id, { identity: 'testid', friendlyName: 'Testhub' })
    })
    td.verify(
        xmpp({
            jid: 'guest@x.com/gatorade',
            password: 'guest',
            host: '192.168.168.168',
            port: '5222',
            disallowTLS: true,
            reconnect: false,
        })
    )

    return result
})

test('Checking pairHub w invalid', t => {
    td.reset()

    const retStanza = new IQ({
        id: 1,
    })

    retStanza.c('oa', {}).t(encodeRequest({}))

    td.when(xmpp.prototype.once('online')).thenCallback({ _resource: 'test' })
    td.when(xmpp.prototype.send(td.matchers.anything())).thenDo(x => {
        debug('Id received', x.attrs.id)
        retStanza.attrs.id = x.attrs.id
    })
    td.when(xmpp.prototype.on('stanza')).thenCallback(retStanza)

    const result: any = pairHub(new URL(myHarmony)).catch(e => {
        t.is(e.message, 'Did not retrieve identity.')
    })

    td.verify(
        xmpp({
            jid: 'guest@x.com/gatorade',
            password: 'guest',
            host: '192.168.168.168',
            port: '5222',
            disallowTLS: true,
            reconnect: false,
        })
    )

    return result
})

test('Checking pairHub with invalid response 2', t => {
    td.reset()

    const retStanza = new IQ({
        id: 1,
    })

    retStanza.c('oa', {}).t(encodeRequest({}))

    td.when(xmpp.prototype.once('online')).thenCallback({ _resource: 'test' })

    td.when(xmpp.prototype.on('stanza')).thenCallback(retStanza)

    pairHub(new URL(myHarmony))
    td.verify(
        xmpp({
            jid: 'guest@x.com/gatorade',
            password: 'guest',
            host: '192.168.168.168',
            port: '5222',
            disallowTLS: true,
            reconnect: false,
        })
    )
    t.pass()
})

test('Checking loginWithIdentity with error', t => {
    td.reset()
    td.when(xmpp.prototype.once('error')).thenCallback(new Error('test'))

    return loginWithIdentity(new URL(myHarmony), {
        identity: 'test',
        friendlyName: 'testhub',
    })
        .then((client: IHarmonyHubConnection) => {
            t.fail()
        })
        .catch(e => {
            t.is(e.message, 'test')
        })
})

test('Checking loginWithIdentity', t => {
    td.reset()
    const myxmpp = td.object(['once', 'removeAllListeners'])
    td.when(myxmpp.once('online')).thenCallback()
    td.when(
        xmpp.prototype.constructor({
            jid: 'testid@connect.logitech.com/gatorade',
            password: 'testid',
            host: '192.168.168.168',
            port: '5222',
            disallowTLS: true,
            reconnect: true,
        })
    ).thenReturn(myxmpp)
    return loginWithIdentity(new URL(myHarmony), {
        friendlyName: 'testhub',
        identity: 'testid',
    }).then((info: IHarmonyHubConnection) => {
        t.is(info.client, myxmpp)
        t.is(info.friendlyName, 'testhub')
        t.deepEqual(info.url, new URL(myHarmony))
    })
})

test('createHarmonyClient', t => {
    td.reset()
    const myxmpp = td.object(['once', 'removeAllListeners'])
    td.when(myxmpp.once('online')).thenCallback()
    td.when(
        xmpp.prototype.constructor({
            jid: 'testid@connect.logitech.com/gatorade',
            password: 'testid',
            host: '192.168.1.1',
            port: '5222',
            disallowTLS: true,
            reconnect: true,
        })
    ).thenReturn(myxmpp)

    const retStanza = new IQ({
        id: 1,
    })

    retStanza.c('oa', {}).t(encodeRequest({ identity: 'testid' }))

    td.when(xmpp.prototype.once('online')).thenCallback({ _resource: 'test' })
    td.when(xmpp.prototype.send(td.matchers.anything())).thenDo(x => {
        debug('Id received', x.attrs.id)
        retStanza.attrs.id = x.attrs.id
    })
    td.when(xmpp.prototype.on('stanza')).thenCallback(retStanza)
    return createHarmonyClient('xmpp://192.168.1.1:5222').then(
        (connection: any) => {
            t.is(connection.client, myxmpp)
        }
    )
})

test('Can create harmony command stanzas', t => {
    const stanza = buildCommandIqStanza('holdAction', {
        status: 'press',
        timestamp: 0,
        action:
            '{"command":"VolumeDown","type":"IRCommand","deviceId":"46156292"}',
    })

    t.is(stanza.attr('type'), 'get')
    t.is(!isNaN(parseInt(stanza.attr('id'), 0)), true)

    t.is(
        stanza.getChild('oa').toString(),
        '<oa xmlns="connect.logitech.com" mime="vnd.logitech.harmony/vnd.logitech.harmony.engine?holdAction">' +
            'status=press:timestamp=0:action={"command"::"VolumeDown","type"::"IRCommand","deviceId"::"46156292"}</oa>'
    )
})
