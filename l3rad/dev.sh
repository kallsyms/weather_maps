#!/bin/sh
exec docker run -it --rm -v $(pwd):/src -p 5000:5000 -e GOOGLE_APPLICATION_CREDENTIALS=/src/service_account.json radserv
