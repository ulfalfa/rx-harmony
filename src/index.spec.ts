import { test } from 'ava'

import { TEST_CONSTANT, testFunction } from './index'

test('First Test', t => {
    t.is(TEST_CONSTANT, 'HELLO WORLD')
})
test('Second Test', t => {
    t.is(TEST_CONSTANT, 'HELLO WORLD')
})

test('Test function', t => {
    t.is(testFunction('World'), 'Hello World')
})
