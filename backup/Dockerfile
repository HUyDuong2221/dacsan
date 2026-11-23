# Container sao lưu: pg_dump (cùng phiên bản Postgres 16 với service db) + GNU tar + múi giờ.
FROM postgres:16-alpine
RUN apk add --no-cache tar tzdata
COPY backup.sh /usr/local/bin/backup.sh
# phòng khi tệp bị đổi sang CRLF trên Windows
RUN sed -i 's/\r$//' /usr/local/bin/backup.sh && chmod +x /usr/local/bin/backup.sh
ENTRYPOINT ["/usr/local/bin/backup.sh"]
