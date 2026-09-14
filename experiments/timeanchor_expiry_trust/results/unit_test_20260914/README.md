# Chaincode unit-test record (2026-09-14)

Runner: `hyperledger/fabric-ccenv:2.4` (Go 1.18.10), invoked as
`docker run --rm -v <legalcc>:/src -w /src hyperledger/fabric-ccenv:2.4 go test ./... -v`.
Local `go` is not installed on this host, so the Fabric image is the runner.
Repository commit under test: see `git_commit.txt`.

## Green — shipped check (`go_test.txt`)

All named tests pass on the current chaincode:

- `TestUpdateTimeAnchor_EstablishesAndAdvances`
- `TestUpdateTimeAnchor_RejectsNonAdvancing`
- `TestCheckAccess_SameOrgWithoutGrantIsDenied`
- `TestCheckAccess_RejectsForgedFreshness_PEqualsA` (peer-clock freshness, S1)
- `TestGrantAccess_ReplayedCommandIDRefused` (command-id replay closure)

## Red — earlier circular check (`go_test_old_check.txt`)

To document the S1 defect, `assertProposalTimeIsFresh` was reverted in a
throwaway copy to its pre-repair form, which measured anchor staleness against
the caller-supplied proposal timestamp (`proposed.Sub(anchored)`) instead of
the answering peer's clock (`time.Now().UTC().Sub(anchored)`). Against that
circular check the same `TestCheckAccess_RejectsForgedFreshness_PEqualsA`
constructs `P = A` over a two-hour-stale anchor and is wrongly authorized, so
the test FAILS. This is the red half of the red/green pair the manifest
previously cited without a released artifact. Only the one comparison line
differs between the two runs; the test is identical.
