#!/usr/bin/env node
import { bootstrap } from './cli/bootstrap.js';

const code = await bootstrap(process.argv);
process.exit(code);
