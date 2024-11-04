#!/usr/bin/env bash

base=$(dirname $0)/..

sed -i 's,// console.log,console.log,' $base/src/index.ts
pnpm test run | grep -E '^reuse' | wc -l
sed -i 's,console.log,// console.log,' $base/src/index.ts
