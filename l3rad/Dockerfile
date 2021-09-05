FROM ktyle/gempak

RUN yum install -y python3 python3-pip

COPY requirements.txt /
RUN pip3 install -r /requirements.txt

COPY . /src
WORKDIR /src

ENV PORT 5000
CMD ["/bin/sh", "-c", "gunicorn -w 4 -b 0.0.0.0:${PORT} api:app"]
