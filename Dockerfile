FROM busybox:1 AS build
ARG PHANPY_RELEASE_VERSION

WORKDIR /root/phanpy_release

RUN wget "https://github.com/cheeaun/phanpy/releases/download/${PHANPY_RELEASE_VERSION}/phanpy-dist.tar.gz" && \
    tar -xvf "phanpy-dist.tar.gz" -C /root/phanpy_release && \
    rm "phanpy-dist.tar.gz"

# ---
FROM busybox:1

# Create a non-root user to own the files and run our server
RUN adduser -D static
USER static
WORKDIR /home/static

# Copy the static website
# Use the .dockerignore file to control what ends up inside the image!
COPY --chown=static:static --from=build /root/phanpy_release /home/static

# Run BusyBox httpd
CMD ["httpd", "-f", "-v", "-p", "8080"]
