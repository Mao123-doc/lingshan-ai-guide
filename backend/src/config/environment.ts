import path from 'node:path';
import dotenv from 'dotenv';

// This module must be imported before app/authentication modules.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
