# Privacy

MCPSentry runs on your machine or in your GitHub Actions job. It does not upload your source code.

The only optional network call is a lookup of npm package names and versions against the public [OSV](https://osv.dev) API when a lockfile is present. You can disable that with `--no-osv`.

The scanner does not phone home, does not create an account, and does not store reports unless you pass `--out`.
