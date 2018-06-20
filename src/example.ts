import * as Debug from 'debug';

import { observeAll } from './harmony-universe';

const debug = Debug('rxharmony:example');

const sub = observeAll((info, hub) => {
    debug('Info', info);
    debug('Hub', hub);
}).subscribe(event => {
    debug('Event', event);
});

/*HarmonyDiscover.observe()
    .pipe(take(1))
    .toPromise()
    .then(info => {
        console.log(info)
        return HarmonyDiscover.discover(info.ip)
    })
    .then(info => {
        console.log(info)
        return info.ip
    })
*/

/*
const hub = new HarmonyHub('xmpp://192.168.168.26', 5000)

hub.observe()
    .pipe(take(6))
    .subscribe(data => {
        // console.log(data)
    })
*/
/*hub.getConfig().then(data => {
    //writeFileSync('./harmony.json', inspect(data, { depth: null }))
    console.log(data)
})*/
/*
setTimeout(
    () =>
        hub.press('VolumeDown', 4000).catch(e => {
            hub.unsubscribe()
        }),
    5000
)*/

process.on('SIGINT', function() {
    console.log('Caught interrupt signal');
    sub.unsubscribe();

    process.exit();
});
