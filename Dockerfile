# The public site in one image (see nginx.container.conf): the Docusaurus build
# of site/, plus the redirects from the old hosts.
# The site is built on the Mac by the Shipiru build command; nothing builds here.
FROM nginx:1.29-alpine
COPY nginx.container.conf /etc/nginx/conf.d/default.conf
COPY site/build /usr/share/nginx/html/site
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
