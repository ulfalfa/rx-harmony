import * as Debug from 'debug'

const debug = Debug('rxharmony:login')
import { Client, xml, jid } from '@xmpp/client'
//
import * as xmpp from 'node-xmpp-client'

const JID = 'guest@x.com'
const PASSWORD = 'guest'

function getUniqueId() {
    return Math.floor(Math.random() * 1000000)
}

function decodeColonSeparatedResponse(response) {
    var result

    if (response && typeof response === 'string') {
        var pairs = response.split(':') || [response]
        result = {}

        pairs.forEach(function(pair) {
            var keyValue = pair.split('=')

            if (keyValue.length === 2) {
                result[keyValue[0]] = keyValue[1]
            }
        })
    }

    return result
}

function buildIqStanza(type, xmlns, mime, body, from) {
    const iq = new xml(
        'iq',
        {
            type: type,
            id: getUniqueId(),
            from: from,
        },
        xml(
            'oa',
            {
                xmlns: xmlns,
                mime: mime,
            },
            body
        )
    )

    return iq
}

export async function pairHub(url: string): Promise<any> {
    const xmppClient = new xmpp({
        jid: 'guest@x.com/gatorade',
        password: 'guest',
        host: '192.168.168.26',
        port: 5222,
        disallowTLS: true,
        reconnect: true,
    })

    let iqId
    const retPromise = new Promise((resolve, reject) => {
        xmppClient.on('connect', () => {
            debug('XMPP client connected')
        })

        xmppClient.on('online', id => {
            debug('XMPP client online', id)
            const iq = buildIqStanza(
                'get',
                'connect.logitech.com',
                'vnd.logitech.connect/vnd.logitech.pair',
                'method=pair:name=rxharmony#iOS6.0.1#iPhone',
                'guest'
            )

            iqId = iq.attr('id')
            xmppClient.send(iq)
        })

        xmppClient.on('error', function(e) {
            debug('XMPP client error', e)
        })

        xmppClient.on('disconnect', function(what) {
            debug('XMPP disconnects', what)
        })
        xmppClient.on('reconnecting', function(what) {
            debug('XMPP reconnect', what)
        })
        xmppClient.on('reconnect', function(what) {
            debug('XMPP reconnect', what)
        })

        xmppClient.on('stanza', stanza => {
            debug('Stanza received')
            debug('Stanza received', stanza.toString())
            if (stanza.attrs.id === iqId.toString()) {
                const body = stanza.getChildText('oa')
                const response = decodeColonSeparatedResponse(body)

                if (response.identity && response.identity !== undefined) {
                    debug('received identity token: ' + response.identity)
                    resolve(response.identity)
                } else {
                    debug('could not find identity token')
                    xmppClient.stop()
                    reject(new Error('Did not retrieve identity.'))
                }
            }
        })
    })
    /*  xmppClient
        .start({ uri: url, domain: 'x.com' })
        .then(data => {
            debug('Finished', data)
        })
        .catch(data => {
            debug('Errored', data)
        })*/
    return retPromise
}

export function loginWithIdentity(url: string, identity: string) {
    debug('create xmpp client using retrieved identity token: ' + identity)

    const jid = identity + '@connect.logitech.com/gatorade'
    const password = identity
    const xmppClient = new Client()
    const myPromise = new Promise((resolve, reject) => {
        xmppClient.handle('authenticate', authenticate => {
            debug('Authenticate')
            return authenticate(jid, password)
                .then(data => {
                    debug('Auth success')
                    return data
                })
                .catch(e => {
                    debug('Error auth', e)
                    reject(e)
                })
        })

        xmppClient.on('status', status => {
            debug('Status', status)
        })

        xmppClient.on('input', input => {
            debug('INput ', input.toString())
        })

        xmppClient.on('output', output => {
            debug('OUTput ', output.toString())
        })

        xmppClient.once('connect', () => {
            debug('XMPP client connected using identity token')
            resolve(xmppClient)
        })
    })
    return xmppClient.start({ uri: url }).then(() => {
        return myPromise
    })
}
