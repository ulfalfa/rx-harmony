# rx-harmonyhub

`rx-harmonyhub` is a reactive class library for node.js which allows to interact with your Logitech Harmony hubs.

It is inspired and heavily basend upon [@swissmanu](https://github.com/swissmanu/harmonyhubjs-client) `harmonyhubsjs-client` and `harmonyhubjs-discover`.

## Why I wrote thies library

On the one hand I'm experimenting with rxjs and the reactive coding style and on the other hand I missed a combination out of both librarys and a more robust error handling, a retry mechanism. Additionally I'm currently in love with typescript.

## Installation

```bash
npm install rx-harmony
```

## Usage

```javascript
// first create a connection to a hub
const hub = new HarmonyHub('xmpp://192.168.168.26', 5000)

// observe the events, the hub sends
hub.observe()
    .pipe(take(6))
    .subscribe(data => {
        // console.log(data)
    })

// gather configuration data
hub.getConfig().then(data => {
    //writeFileSync('./harmony.json', inspect(data, { depth: null }))
    console.log(data)
})

setTimeout(
    () =>
        //press a button in current activity
        hub.press('VolumeDown', 4000).catch(e => {
            hub.unsubscribe()
        }),
    5000
)
```

## Debug Traces

As `swissmanu`'s library `rx-harmony` uses [debug](https://github.com/visionmedia/debug) for generating traces. Activate them by setting the`DEBUG` environment variable:

```bash
$ DEBUG=rx-harmony:* node myapp.js
```

## License

Copyright (c) 2018 Ulf Steinberg

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
