# --- shipiru ---------------------------------------------------------------
SHIPIRU ?= $(HOME)/projects/shipiru-diy/bin/shipiru
.PHONY: deploy logs restart rollback
deploy:
	$(SHIPIRU) deploy reactmarkdownkit
logs:
	$(SHIPIRU) logs reactmarkdownkit
restart:
	$(SHIPIRU) restart reactmarkdownkit
rollback:
	$(SHIPIRU) rollback reactmarkdownkit $(TAG)

# --- npm ------------------------------------------------------------------
# `make publish` releases every public package under packages/ and plugins/.
# pnpm skips versions the registry already has, so bump the version in each
# package.json first; `make publish OTP=123456` passes a 2FA code through and
# `NPM_TAG=next` publishes under a dist-tag instead of `latest`.
PNPM ?= pnpm
PUBLISHABLE = --filter './packages/*' --filter './plugins/*'
PUBLISH_FLAGS = $(if $(OTP),--otp $(OTP)) $(if $(NPM_TAG),--tag $(NPM_TAG))

.PHONY: build check publish-dry publish
build:
	$(PNPM) install --frozen-lockfile
	$(PNPM) build
check: build
	$(PNPM) typecheck
	$(PNPM) test
	$(PNPM) pack:check
publish-dry: build
	$(PNPM) -r $(PUBLISHABLE) publish --dry-run --no-git-checks $(PUBLISH_FLAGS)
publish: check
	@npm whoami >/dev/null 2>&1 || { echo "Not logged in to npm. Run: npm login"; exit 1; }
	$(PNPM) -r $(PUBLISHABLE) publish $(PUBLISH_FLAGS)
