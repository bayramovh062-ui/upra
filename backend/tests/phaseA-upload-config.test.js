import fs from 'node:fs';
import { AppError } from '../src/utils/AppError.js';
import {
  assertUploadStorageReady,
  getLocalPath,
  localKeyFromUrl,
  storeFile,
} from '../src/services/uploadService.js';

// Phase A (A1): production must never silently fall back to the ephemeral local disk.
// Local uploads stay available for development and tests.

const ENV_KEYS = [
  'NODE_ENV',
  'UPLOAD_PROVIDER',
  'UPLOAD_LOCAL_DIR',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const original = {};

const setEnv = (values) => {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value;
  }
};

const expect503 = (fn) => {
  let caught;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(AppError);
  expect(caught.statusCode).toBe(503);
};

const sampleFile = () => {
  const buffer = Buffer.from('phase-a upload config');
  return { buffer, size: buffer.length, originalname: 'phase-a.txt', mimetype: 'text/plain' };
};

describe('Phase A upload storage configuration', () => {
  beforeAll(() => {
    for (const key of ENV_KEYS) original[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('allows local storage in development and test', async () => {
    setEnv({ NODE_ENV: 'test', UPLOAD_PROVIDER: 'local' });
    expect(assertUploadStorageReady()).toBe('local');

    setEnv({ NODE_ENV: 'development', UPLOAD_PROVIDER: 'local' });
    expect(assertUploadStorageReady()).toBe('local');
  });

  it('stores locally in test and cleans up the written file', async () => {
    setEnv({ NODE_ENV: 'test', UPLOAD_PROVIDER: 'local' });
    const file = sampleFile();
    const key = `phasea-${Date.now()}-${process.pid}.txt`;
    const filePath = getLocalPath(key);

    try {
      const stored = await storeFile(file, { purpose: 'MILESTONE_SUBMIT' });
      expect(stored.provider).toBe('local');
      expect(stored.url).toMatch(/^\/api\/uploads\/local\//);
      const storedKey = localKeyFromUrl(stored.url);
      expect(storedKey).toBeTruthy();

      const storedPath = getLocalPath(storedKey);
      expect(fs.existsSync(storedPath)).toBe(true);
      expect(fs.readFileSync(storedPath)).toEqual(file.buffer);
      fs.unlinkSync(storedPath);
    } finally {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('rejects local storage in production when Cloudinary is not configured', () => {
    setEnv({ NODE_ENV: 'production', UPLOAD_PROVIDER: 'local' });
    expect503(() => assertUploadStorageReady());

    setEnv({ NODE_ENV: 'production' });
    expect503(() => assertUploadStorageReady());
  });

  it('rejects a production upload instead of writing bytes to local disk', async () => {
    setEnv({ NODE_ENV: 'production' });
    await expect(storeFile(sampleFile(), { purpose: 'MILESTONE_SUBMIT' })).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it('rejects explicit Cloudinary selection with incomplete credentials', () => {
    setEnv({
      NODE_ENV: 'test',
      UPLOAD_PROVIDER: 'cloudinary',
      CLOUDINARY_CLOUD_NAME: 'example-cloud',
    });
    expect503(() => assertUploadStorageReady());

    setEnv({
      NODE_ENV: 'production',
      UPLOAD_PROVIDER: 'cloudinary',
      CLOUDINARY_CLOUD_NAME: 'example-cloud',
      CLOUDINARY_API_KEY: 'example-key',
    });
    expect503(() => assertUploadStorageReady());
  });

  it('accepts a complete Cloudinary configuration in production', () => {
    setEnv({
      NODE_ENV: 'production',
      UPLOAD_PROVIDER: 'cloudinary',
      CLOUDINARY_CLOUD_NAME: 'example-cloud',
      CLOUDINARY_API_KEY: 'example-key',
      CLOUDINARY_API_SECRET: 'example-secret',
    });
    expect(assertUploadStorageReady()).toBe('cloudinary');
  });

  it('rejects an unsupported upload provider', () => {
    setEnv({ NODE_ENV: 'test', UPLOAD_PROVIDER: 's3' });
    expect503(() => assertUploadStorageReady());
  });
});
