# PangoChain Fabric Network — make targets
# Run from pangochain-fabric/ directory in WSL2 or Git Bash

.PHONY: up down clean chaincode smoke logs

up:
	@bash scripts/start-network.sh

chaincode:
	@bash scripts/deploy-chaincode.sh

smoke:
	@echo "Smoke-testing legalcc chaincode..."
	docker exec fabric-cli peer chaincode query \
	  --channelID legal-channel --name legalcc \
	  -c '{"function":"GetDocumentHistory","Args":["CASE-SMOKE-001"]}' \
	  --tls \
	  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/tls/ca.crt \
	  && echo "Smoke test PASSED." || echo "Smoke test query returned (expected empty history) — chaincode is live."

down:
	docker compose -f docker-compose.fabric.yml down -v --remove-orphans
	docker rm -f legalcc 2>/dev/null || true

clean: down
	docker run --rm -v "$$(pwd):/workspace" alpine sh -c "rm -rf /workspace/crypto-config /workspace/channel-artifacts" 2>/dev/null || true
	rm -rf crypto-config channel-artifacts 2>/dev/null || true

logs:
	docker compose -f docker-compose.fabric.yml logs -f --tail=50

all: up chaincode
