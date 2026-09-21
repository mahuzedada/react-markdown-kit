# Six static sites in one image, routed by host name (see nginx.container.conf).
# The sites are built on the Mac by the Shipiru build command; nothing builds here.
FROM nginx:1.29-alpine
COPY nginx.container.conf /etc/nginx/conf.d/default.conf
COPY public-sites/home/build          /usr/share/nginx/html/home
COPY public-sites/docs/build          /usr/share/nginx/html/docs
COPY public-sites/mermaid-demo/build  /usr/share/nginx/html/mermaid
COPY public-sites/slides-demo/build   /usr/share/nginx/html/slides
COPY public-sites/renderer-demo/build /usr/share/nginx/html/renderer
COPY public-sites/editor-demo/build   /usr/share/nginx/html/editor
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
