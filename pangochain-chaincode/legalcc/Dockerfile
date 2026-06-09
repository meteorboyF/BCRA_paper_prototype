FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o legalcc .

FROM alpine:3.18
WORKDIR /app
COPY --from=builder /app/legalcc .
EXPOSE 7777
CMD ["./legalcc"]
