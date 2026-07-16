#!/usr/bin/env python3
"""Experiment 13 — topology generator (IMPROVEMENTS.md item 3.2).

Emits a complete, self-contained Fabric network definition for N orgs x P
peers/org into generated/o{N}p{P}/: crypto-config.yaml, configtx.yaml,
docker-compose.yml, topology.json. Patterned on pangochain-fabric/ (Fabric
2.4, 3 Raft orderers, CouchDB state DB, TLS, ccaas chaincode) with two
simplifications: no CA containers (cryptogen material only) and internal
DNS instead of static IPs. Only peer0.org1 is exposed to the host (:7051),
matching the single-gateway client pattern of Exp 11/12.

Usage: gen-topology.py --orgs 5 --peers 1 [--out generated]
"""
import argparse
import json
import pathlib

DOMAIN = "pangochain.com"
BATCH = {"timeout": "2s", "max_count": 500, "abs_bytes": "99 MB", "pref_bytes": "2 MB"}


def org_name(i):
    return f"Org{i}"


def org_domain(i):
    return f"org{i}.{DOMAIN}"


def crypto_config(n_orgs, n_peers):
    out = [f"""OrdererOrgs:
  - Name: Orderer
    Domain: {DOMAIN}
    EnableNodeOUs: true
    Specs:
      - Hostname: orderer1
      - Hostname: orderer2
      - Hostname: orderer3

PeerOrgs:"""]
    for i in range(1, n_orgs + 1):
        out.append(f"""  - Name: {org_name(i)}
    Domain: {org_domain(i)}
    EnableNodeOUs: true
    Template:
      Count: {n_peers}
    Users:
      Count: 1""")
    return "\n".join(out) + "\n"


def configtx(n_orgs):
    orgs = []
    for i in range(1, n_orgs + 1):
        name, dom = org_name(i), org_domain(i)
        orgs.append(f"""  - &{name}
    Name: {name}MSP
    ID: {name}MSP
    MSPDir: crypto-config/peerOrganizations/{dom}/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('{name}MSP.admin', '{name}MSP.peer', '{name}MSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('{name}MSP.admin', '{name}MSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('{name}MSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('{name}MSP.peer')"
    AnchorPeers:
      - Host: peer0.{dom}
        Port: 7051""")
    org_refs = "\n".join(f"          - *{org_name(i)}" for i in range(1, n_orgs + 1))
    consenters = "\n".join(f"""      - Host: orderer{k}.{DOMAIN}
        Port: 7050
        ClientTLSCert: crypto-config/ordererOrganizations/{DOMAIN}/orderers/orderer{k}.{DOMAIN}/tls/server.crt
        ServerTLSCert: crypto-config/ordererOrganizations/{DOMAIN}/orderers/orderer{k}.{DOMAIN}/tls/server.crt"""
                           for k in (1, 2, 3))
    return f"""---
Organizations:
  - &OrdererOrg
    Name: OrdererOrg
    ID: OrdererMSP
    MSPDir: crypto-config/ordererOrganizations/{DOMAIN}/msp
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('OrdererMSP.member')"
      Writers:
        Type: Signature
        Rule: "OR('OrdererMSP.member')"
      Admins:
        Type: Signature
        Rule: "OR('OrdererMSP.admin')"

{chr(10).join(orgs)}

Capabilities:
  Channel: &ChannelCapabilities
    V2_0: true
  Orderer: &OrdererCapabilities
    V2_0: true
  Application: &ApplicationCapabilities
    V2_0: true

Application: &ApplicationDefaults
  Organizations:
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
    LifecycleEndorsement:
      Type: ImplicitMeta
      Rule: "MAJORITY Endorsement"
    Endorsement:
      Type: ImplicitMeta
      Rule: "MAJORITY Endorsement"
  Capabilities:
    <<: *ApplicationCapabilities

Orderer: &OrdererDefaults
  OrdererType: etcdraft
  Addresses:
    - orderer1.{DOMAIN}:7050
    - orderer2.{DOMAIN}:7050
    - orderer3.{DOMAIN}:7050
  BatchTimeout: {BATCH['timeout']}
  BatchSize:
    MaxMessageCount: {BATCH['max_count']}
    AbsoluteMaxBytes: {BATCH['abs_bytes']}
    PreferredMaxBytes: {BATCH['pref_bytes']}
  EtcdRaft:
    Consenters:
{consenters}
  Organizations:
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
    BlockValidation:
      Type: ImplicitMeta
      Rule: "ANY Writers"
  Capabilities:
    <<: *OrdererCapabilities

Channel: &ChannelDefaults
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
  Capabilities:
    <<: *ChannelCapabilities

Profiles:
  LegalOrdererGenesis:
    <<: *ChannelDefaults
    Orderer:
      <<: *OrdererDefaults
      Organizations:
        - *OrdererOrg
    Consortiums:
      LegalConsortium:
        Organizations:
{org_refs}

  LegalChannel:
    Consortium: LegalConsortium
    <<: *ChannelDefaults
    Application:
      <<: *ApplicationDefaults
      Organizations:
{org_refs}
      Capabilities:
        <<: *ApplicationCapabilities
"""


def couch_service(i, p):
    name = f"couchdb.org{i}.p{p}"
    return f"""  {name}:
    image: couchdb:3.3
    container_name: {name}
    environment:
      COUCHDB_USER: admin
      COUCHDB_PASSWORD: adminpw
    networks:
      fabric_test:
        aliases: [{name}]
"""


def orderer_service(k):
    host = f"orderer{k}.{DOMAIN}"
    return f"""  {host}:
    image: hyperledger/fabric-orderer:2.4
    container_name: {host}
    environment:
      FABRIC_LOGGING_SPEC: INFO
      ORDERER_GENERAL_LISTENADDRESS: 0.0.0.0
      ORDERER_GENERAL_LISTENPORT: 7050
      ORDERER_GENERAL_LOCALMSPID: OrdererMSP
      ORDERER_GENERAL_LOCALMSPDIR: /var/hyperledger/orderer/msp
      ORDERER_GENERAL_BOOTSTRAPMETHOD: file
      ORDERER_GENERAL_BOOTSTRAPFILE: /var/hyperledger/orderer/orderer.genesis.block
      ORDERER_GENERAL_TLS_ENABLED: "true"
      ORDERER_GENERAL_TLS_PRIVATEKEY: /var/hyperledger/orderer/tls/server.key
      ORDERER_GENERAL_TLS_CERTIFICATE: /var/hyperledger/orderer/tls/server.crt
      ORDERER_GENERAL_TLS_ROOTCAS: "[/var/hyperledger/orderer/tls/ca.crt]"
      ORDERER_GENERAL_CLUSTER_CLIENTCERTIFICATE: /var/hyperledger/orderer/tls/server.crt
      ORDERER_GENERAL_CLUSTER_CLIENTPRIVATEKEY: /var/hyperledger/orderer/tls/server.key
      ORDERER_GENERAL_CLUSTER_ROOTCAS: "[/var/hyperledger/orderer/tls/ca.crt]"
      ORDERER_CONSENSUS_WALDIR: /var/hyperledger/production/orderer/etcdraft/wal
      ORDERER_CONSENSUS_SNAPDIR: /var/hyperledger/production/orderer/etcdraft/snapshot
    volumes:
      - ./crypto-config/ordererOrganizations/{DOMAIN}/orderers/{host}/msp:/var/hyperledger/orderer/msp
      - ./crypto-config/ordererOrganizations/{DOMAIN}/orderers/{host}/tls:/var/hyperledger/orderer/tls
      - ./channel-artifacts/genesis.block:/var/hyperledger/orderer/orderer.genesis.block
    networks:
      fabric_test:
        aliases: [{host}]
"""


def peer_service(i, p, expose):
    dom = org_domain(i)
    host = f"peer{p}.{dom}"
    couch = f"couchdb.org{i}.p{p}"
    ports = '    ports:\n      - "7051:7051"\n' if expose else ""
    return f"""  {host}:
    image: hyperledger/fabric-peer:2.4
    container_name: {host}
    environment:
      CORE_VM_ENDPOINT: unix:///host/var/run/docker.sock
      CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE: fabric_test
      FABRIC_LOGGING_SPEC: INFO
      CORE_PEER_TLS_ENABLED: "true"
      CORE_PEER_PROFILE_ENABLED: "false"
      CORE_PEER_TLS_CERT_FILE: /etc/hyperledger/fabric/tls/server.crt
      CORE_PEER_TLS_KEY_FILE: /etc/hyperledger/fabric/tls/server.key
      CORE_PEER_TLS_ROOTCERT_FILE: /etc/hyperledger/fabric/tls/ca.crt
      CORE_PEER_ID: {host}
      CORE_PEER_ADDRESS: {host}:7051
      CORE_PEER_LISTENADDRESS: 0.0.0.0:7051
      CORE_PEER_CHAINCODEADDRESS: {host}:7052
      CORE_PEER_CHAINCODELISTENADDRESS: 0.0.0.0:7052
      CORE_PEER_GOSSIP_BOOTSTRAP: peer0.{dom}:7051
      CORE_PEER_GOSSIP_EXTERNALENDPOINT: {host}:7051
      CORE_PEER_LOCALMSPID: {org_name(i)}MSP
      CORE_PEER_MSPCONFIGPATH: /etc/hyperledger/fabric/msp
      CORE_LEDGER_STATE_STATEDATABASE: CouchDB
      CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS: {couch}:5984
      CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME: admin
      CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD: adminpw
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ./crypto-config/peerOrganizations/{dom}/peers/{host}/msp:/etc/hyperledger/fabric/msp
      - ./crypto-config/peerOrganizations/{dom}/peers/{host}/tls:/etc/hyperledger/fabric/tls
{ports}    depends_on:
      - {couch}
      - orderer1.{DOMAIN}
    networks:
      fabric_test:
        aliases: [{host}]
"""


def cli_service(n_orgs, n_peers):
    dom1 = org_domain(1)
    deps = "\n".join(f"      - peer{p}.{org_domain(i)}"
                     for i in range(1, n_orgs + 1) for p in range(n_peers))
    return f"""  cli:
    image: hyperledger/fabric-tools:2.4
    container_name: fabric-cli
    tty: true
    stdin_open: true
    environment:
      GOPATH: /opt/gopath
      FABRIC_LOGGING_SPEC: INFO
      CORE_PEER_ID: cli
      CORE_PEER_ADDRESS: peer0.{dom1}:7051
      CORE_PEER_LOCALMSPID: Org1MSP
      CORE_PEER_TLS_ENABLED: "true"
      CORE_PEER_TLS_ROOTCERT_FILE: /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/{dom1}/peers/peer0.{dom1}/tls/ca.crt
      CORE_PEER_MSPCONFIGPATH: /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/{dom1}/users/Admin@{dom1}/msp
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric/peer
    command: /bin/bash
    volumes:
      - /var/run/docker.sock:/host/var/run/docker.sock
      - ./crypto-config:/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto
      - ./channel-artifacts:/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts
    depends_on:
{deps}
    networks:
      fabric_test:
        aliases: [fabric-cli]
"""


def compose(n_orgs, n_peers):
    parts = ["networks:\n  fabric_test:\n    name: fabric_test\n    driver: bridge\n",
             "services:"]
    for i in range(1, n_orgs + 1):
        for p in range(n_peers):
            parts.append(couch_service(i, p))
    for k in (1, 2, 3):
        parts.append(orderer_service(k))
    for i in range(1, n_orgs + 1):
        for p in range(n_peers):
            parts.append(peer_service(i, p, expose=(i == 1 and p == 0)))
    parts.append(cli_service(n_orgs, n_peers))
    return "\n".join(parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--orgs", type=int, required=True)
    ap.add_argument("--peers", type=int, default=1)
    ap.add_argument("--out", default=str(pathlib.Path(__file__).parent / "generated"))
    args = ap.parse_args()

    dest = pathlib.Path(args.out) / f"o{args.orgs}p{args.peers}"
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "crypto-config.yaml").write_text(crypto_config(args.orgs, args.peers))
    (dest / "configtx.yaml").write_text(configtx(args.orgs))
    (dest / "docker-compose.yml").write_text(compose(args.orgs, args.peers))
    (dest / "topology.json").write_text(json.dumps({
        "orgs": args.orgs, "peers_per_org": args.peers, "domain": DOMAIN,
        "org_names": [org_name(i) for i in range(1, args.orgs + 1)],
        "org_domains": [org_domain(i) for i in range(1, args.orgs + 1)],
        "channel": "legal-channel", "batch": BATCH,
    }, indent=2))
    print(f"generated {dest}")


if __name__ == "__main__":
    main()
