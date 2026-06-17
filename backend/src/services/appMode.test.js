describe('isHostedMode', () => {
  const ORIGINAL_ENV = process.env.APP_MODE;

  afterEach(() => {
    process.env.APP_MODE = ORIGINAL_ENV;
  });

  it('is false when APP_MODE is unset (the local/Electron default)', () => {
    delete process.env.APP_MODE;
    jest.resetModules();
    const { isHostedMode } = require('./appMode');
    expect(isHostedMode()).toBe(false);
  });

  it('is false for any value other than the literal string "hosted"', () => {
    process.env.APP_MODE = 'local';
    jest.resetModules();
    expect(require('./appMode').isHostedMode()).toBe(false);
  });

  it('is true only when APP_MODE=hosted', () => {
    process.env.APP_MODE = 'hosted';
    jest.resetModules();
    expect(require('./appMode').isHostedMode()).toBe(true);
  });
});
