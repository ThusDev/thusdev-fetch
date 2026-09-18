# Security Policy

## Supported versions

Security fixes are applied to the latest published version.

## Reporting a vulnerability

Please do not open a public issue for a suspected security vulnerability.

Use GitHub's private security reporting for the ThusDev repository when available. Include:

- affected version
- affected component
- reproduction steps
- impact
- suggested mitigation, if known

Please avoid including secrets, personal data, or production credentials in reports.

## Security practices

ThusDev Fetch redacts common credential-bearing headers in debug logs. Applications should still avoid placing secrets in URLs, request bodies, error messages, or application logs.
