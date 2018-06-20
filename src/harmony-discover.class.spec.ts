import { serial, TestInterface } from 'ava';

import { EventEmitter } from 'events';

import * as td from 'testdouble';
import * as lolex from 'lolex';
import { Clock } from 'lolex';

const net = td.replace('net');
const dgram = td.replace('dgram');

import { HarmonyDiscover } from './harmony-discover.class';

import { take, pluck, toArray } from 'rxjs/operators';

import * as Debug from 'debug';

const debug = Debug('rxharmony:test');

interface TestSocket extends EventEmitter {
    close?: Function;
}

interface Context {
    clock: Clock;
    socket: TestSocket;
    server: any;
    dsocket: any;
}
const test = serial as TestInterface<Context>;

test.before(() => {
    debug('Creating dgram and net mocks');

    // const dgram = td.replace('dgram')
});

test.beforeEach(t => {
    td.reset();
    const socket: TestSocket = new EventEmitter();
    socket.close = td.function('close');
    const dsocket = td.object(['send', 'bind', 'close']);
    td.when(dgram.createSocket('udp4')).thenReturn(dsocket);
    const server = td.object(['listen', 'close', 'address']);
    td.when(net.createServer(td.callback(socket))).thenReturn(server);

    t.context = {
        clock: lolex.install(),
        socket,
        server,
        dsocket,
    };
});

test.afterEach(t => {
    t.context.clock.uninstall();
});

test.cb('Is initializable and creates a server', t => {
    const discover = new HarmonyDiscover();

    discover['_hubInfo$'].pipe(take(1)).subscribe((data: any) => {
        t.deepEqual(data, {
            hello: 'world',
            goodbye: 'earth',
            lastSeen: new Date(),
            state: 1,
        });
        t.end();
    });
    t.context.socket.emit('data', 'hello:world;');
    t.context.socket.emit('data', 'goodbye:earth');
    t.context.socket.emit('end');
});

test('Observe single network', t => {
    const prom = HarmonyDiscover.observe()
        .pipe(
            pluck('state'),
            take(2),
            toArray()
        )
        .toPromise();

    t.context.socket.emit('data', 'uuid:test1;');
    t.context.socket.emit('data', 'goodbye:earth');
    t.context.socket.emit('end');
    t.context.clock.tick(10000);
    td.verify(
        t.context.dsocket.send(
            td.matchers.anything(),
            0,
            43,
            5224,
            '255.255.255.255',
            td.matchers.anything()
        ),
        { times: 10 }
    );

    return prom.then(data => {
        t.deepEqual(data, [1, 0]);
    });
});
