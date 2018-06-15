import * as Debug from 'debug'

const debug = Debug('rxharmony:login')
import { Client, xml, jid } from '@xmpp/client'

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
    const xmppClient = new Client()

    const _jid = jid('guest@x.com')
    debug(_jid.toString())

    let iqId
    const retPromise = new Promise((resolve, reject) => {
        xmppClient.on('connect', () => {
            debug('XMPP client connected')
        })

        xmppClient.on('open', el => {
            debug('XMPP client open', el.toString())
            const iq = buildIqStanza(
                'get',
                'connect.logitech.com',
                'vnd.logitech.connect/vnd.logitech.pair',
                'method=pair:name=rxharmony#iOS6.0.1#iPhone',
                'guest'
            )

            iqId = iq.attr('id')
            //debug('IQ,id', iq.toString(), iqId)

            // xmppClient.send(iq)
        })

        xmppClient.handle('authenticate', authenticate => {
            debug('Authenticate')
            return authenticate('guest@x.com', 'guest')
                .then(data => {
                    debug('Auth success', debug(xmppClient.openOptions))
                    return data
                })
                .catch(e => {
                    debug('Error auth', e)
                })
        })

        xmppClient.on('online', id => {
            debug('XMPP client online', id)
        })

        xmppClient.on('error', function(e) {
            debug('XMPP client error', e)
        })

        xmppClient.on('input', function(e) {
            debug('XMPP input', e)
        })

        xmppClient.on('output', function(e) {
            debug('XMPP output', e)
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

        xmppClient.on('status', (...args) => {
            debug(args)
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
    xmppClient
        .start({ uri: url, domain: 'x.com' })
        .then(data => {
            debug('Finished', data)
        })
        .catch(data => {
            debug('Errored', data)
        })
    return retPromise
}

export function loginWithIdentity(url: string, identity: string) {
    debug('create xmpp client using retrieved identity token: ' + identity)

    const jid = identity + '@connect.logitech.com/gatorade'
    const password = identity
    return new Promise((resolve, reject) => {
        const xmppClient = new Client()

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

        xmppClient.once('connect', () => {
            debug('XMPP client connected using identity token')
            resolve(xmppClient)
        })

        xmppClient.start({ uri: url, timeout: 1000 })
    })
}
