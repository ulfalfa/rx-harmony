import { test } from 'ava'

import { pairHub, loginWithIdentity } from './harmony-login'

const myHarmony = 'xmpp://192.168.168.26:5222/gatorade'

test.skip('Checking library', t => {
    return pairHub(myHarmony).then(data => {
        t.log(`received ${data}`)
        t.is(typeof data, 'string')
    })
})

test.only('Checking library', t => {
    return pairHub(myHarmony)
        .then(id => {
            return loginWithIdentity(myHarmony, id)
        })

        .then(data => {
            t.log(`received ${data}`)
        })
})
