const { generateErrorCode, sendError, asyncRoute } = require('./appError');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('generateErrorCode', () => {
  it('produces a short, greppable, unique-ish code each time', () => {
    const a = generateErrorCode();
    const b = generateErrorCode();
    expect(a).toMatch(/^ERR-[0-9A-F]{6}$/);
    expect(b).toMatch(/^ERR-[0-9A-F]{6}$/);
    expect(a).not.toBe(b);
  });
});

describe('sendError', () => {
  it('responds with the error message and a code, defaulting to 500', () => {
    const res = mockRes();
    sendError(res, new Error('boom'));
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('boom');
    expect(res.body.code).toMatch(/^ERR-[0-9A-F]{6}$/);
  });

  it('honors a custom status code', () => {
    const res = mockRes();
    sendError(res, new Error('nope'), 'context', 403);
    expect(res.statusCode).toBe(403);
  });

  it('falls back to a generic message when the error has none', () => {
    const res = mockRes();
    sendError(res, {});
    expect(res.body.error).toBe('Something went wrong');
  });

  it('logs with the same code it returns to the client', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();
    sendError(res, new Error('boom'), 'my context');
    const loggedArgs = spy.mock.calls[0];
    expect(loggedArgs[0]).toContain(res.body.code);
    expect(loggedArgs[0]).toContain('my context');
    spy.mockRestore();
  });
});

describe('asyncRoute', () => {
  it('passes through a successful async handler untouched', async () => {
    const res = mockRes();
    const handler = asyncRoute(async (req, r) => {
      r.json({ ok: true });
    });
    await handler({}, res, () => {});
    expect(res.body).toEqual({ ok: true });
  });

  it('routes a rejected promise to next(err) instead of hanging', async () => {
    const next = jest.fn();
    const handler = asyncRoute(async () => {
      throw new Error('async boom');
    });
    await handler({}, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].message).toBe('async boom');
  });

  it('routes a synchronous throw to next(err) too, not just async rejections', async () => {
    const next = jest.fn();
    const handler = asyncRoute(() => {
      throw new Error('sync boom');
    });
    await handler({}, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].message).toBe('sync boom');
  });

  it('works with a plain synchronous handler that succeeds', async () => {
    const res = mockRes();
    const handler = asyncRoute((req, r) => {
      r.json({ sync: true });
    });
    await handler({}, res, () => {});
    expect(res.body).toEqual({ sync: true });
  });
});
