# Deploying reactmarkdownkit

One app, one site. The image holds the static build of `site`
under `/usr/share/nginx/html/site`, served at the apex. Every old host answers
with a permanent redirect to its new path on the apex: `docs.` and `www` to the
same path, and the demo subdomains (`renderer.`, `editor.`, `mermaid.`,
`slides.`) from `/` to `/markdown-renderer`, `/markdown-editor`,
`/mermaid-editor` and `/markdown-slides` (`nginx.container.conf` over HTTPS,
`nginx.shipiru.conf` over plain HTTP). The Google and Bing ownership files stay
reachable on every old host. Keep the redirects and the old names on their
certificates. One certificate (`docs.reactmarkdownkit.com`) covers the first six
names; `slides.reactmarkdownkit.com` has its own, in its own `server` blocks at the
end of `nginx.shipiru.conf`, because that is what Shipiru's `add_domain`
writes. `make deploy` rebuilds the packages, the plugins and the site
(`pnpm build:site`), then ships one image.

This app is deployed to the `mahuzedada` VM with [Shipiru](../shipiru-diy/README.md) as a Docker Compose service. Nothing is built on the server.

| | |
|---|---|
| Kind | `static` |
| Host port | `127.0.0.1:9011` (nginx proxies to it) |
| Domains | `docs.reactmarkdownkit.com` `mermaid.reactmarkdownkit.com` `slides.reactmarkdownkit.com` `renderer.reactmarkdownkit.com` `editor.reactmarkdownkit.com` `reactmarkdownkit.com` `www.reactmarkdownkit.com` |
| Server layout | `/srv/apps/reactmarkdownkit/compose.yml`, `/srv/apps/reactmarkdownkit/.env` (secrets, root 0600) |
| Health | `/` |
| Env keys | |

## Files Shipiru owns in this repo

- `Dockerfile`, `.dockerignore`: the linux/amd64 image, built on the Mac.
- `compose.yml`: installed verbatim to `/srv/apps/reactmarkdownkit/compose.yml`.
- `nginx.shipiru.conf`: installed to `/etc/nginx/sites-available/reactmarkdownkit` after `nginx -t`.
- `.shipiru.json`: build command, file names and the HTTPS route checks every deploy must pass.

## Adding a subdomain

A new site (the slides demo, added 2026-09-20, was the last) needs three ops
steps that no file in this repo performs: a DNS `A` record for the subdomain
pointing at the VM, a certificate for the name, and the host nginx reloaded.
Shipiru's `add_domain` (the app `reactmarkdownkit`, the new name) does the
last two: it issues a certificate named after the subdomain and appends an
HTTP redirect block and a TLS block for it to `nginx.shipiru.conf`. Two
things to know before running it: the name must NOT already be in the
file's `server_name` lines (the tool refuses with "already belongs"), and
the DNS record must resolve from this Mac, not only at the authoritative
nameserver, because the tool's final route check and the deploy's route
checks run here (a stale negative cache means waiting out the zone's
negative TTL, 600 s for this zone). Until those are done the route check for
the new subdomain fails and the deploy is held back, which is the point.

## Commands

```sh
make deploy      # build, ship, compose up, wait for health, swap nginx, check routes, then IndexNow
make indexnow    # submit new or changed sitemap URLs to IndexNow again
make logs        # live container logs
make restart
make rollback TAG=<image tag>   # tags: shipiru images reactmarkdownkit
```

After a deploy, `scripts/indexnow.mjs` reads the live sitemap and submits the
URLs that are new or whose lastmod moved since its last run (kept in the
gitignored `.indexnow.json`) to IndexNow, which Bing and the other IndexNow
engines read. The key is `site/static/<key>.txt`, served at the site root;
keep exactly one key file there. Google ignores IndexNow and reads the sitemap.

Environment values are edited on the server only, from the Shipiru Apps page or `shipiru env reactmarkdownkit set KEY=value`; they are never copied to this machine.
