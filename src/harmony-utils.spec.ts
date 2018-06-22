import { test } from 'ava';

import { decodeResponse, encodeRequest } from './harmony-utils';

test('Can encode and decode request', t => {
    const encodedRequest = encodeRequest({
        hello: 'world',
        test: true,
        timestamp: 123,
    });

    t.is(encodedRequest, 'hello=world:test=true:timestamp=123');
    t.deepEqual(decodeResponse(encodedRequest), {
        hello: 'world',
        test: 'true',
        timestamp: '123',
    });
});

test('Can decode nested replies', t => {
    const input = `serverIdentity=77e2af66-XXXX-4cbb-381a-560289d57d26:
                   hubId=106:identity=77e2af66-XXXX-4cbb-381a-560289d57d26:
                    status=succeeded:protocolVersion={XMPP="1.0", HTTP="1.0", RF="1.0", WEBSOCKET="1.0"}:
                    hubProfiles={Harmony="2.0"}:
                    productId=Pimento:friendlyName=MyHub`;

    t.deepEqual(decodeResponse(input), {
        serverIdentity: '77e2af66-XXXX-4cbb-381a-560289d57d26',
        hubId: '106',
        identity: '77e2af66-XXXX-4cbb-381a-560289d57d26',
        status: 'succeeded',
        protocolVersion: {
            XMPP: '1.0',
            HTTP: '1.0',
            RF: '1.0',
            WEBSOCKET: '1.0',
        },
        hubProfiles: { Harmony: '2.0' },
        productId: 'Pimento',
        friendlyName: 'MyHub',
    });
});

test('Can encode nested request', t => {
    const input = {
        status: 'release',
        timestamp: 1000,
        action: {
            action:
                '{"command":"Mute","type":"IRCommand","deviceId":"46156292"}',
            name: 'Mute',
            label: 'Mute',
        },
    };

    t.is(
        encodeRequest(input),
        'status=release:timestamp=1000:action={"command"::"Mute","type"::"IRCommand","deviceId"::"46156292"}:name=Mute:label=Mute'
    );
});
