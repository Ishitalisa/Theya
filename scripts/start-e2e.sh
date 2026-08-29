#!/usr/bin/env bash
set -euo pipefail

RPC_URL="http://127.0.0.1:8546"
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
SECOND_PRIVATE_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
ACCOUNT="0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
TREASURY="0x70997970c51812dc3a010c7d01b50e0d17dc79c8"

anvil --silent --host 127.0.0.1 --port 8546 --chain-id 10143 >.anvil-e2e.log 2>&1 &
ANVIL_PID=$!
APP_PID=""
cleanup() {
  if [[ -n "$APP_PID" ]]; then kill "$APP_PID" 2>/dev/null || true; fi
  kill "$ANVIL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in {1..30}; do
  if cast block-number --rpc-url "$RPC_URL" >/dev/null 2>&1; then break; fi
  sleep 0.2
done

DEPLOY_OUTPUT=$(forge create \
  --root contracts \
  src/FlashMarket.sol:TheyaMarket \
  --broadcast \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --constructor-args "$ACCOUNT" "$ACCOUNT" "$TREASURY")
CONTRACT_ADDRESS=$(printf '%s\n' "$DEPLOY_OUTPUT" | awk '/Deployed to:/ {print $3}')

if [[ -z "$CONTRACT_ADDRESS" ]]; then
  printf '%s\n' "$DEPLOY_OUTPUT"
  exit 1
fi

PUBLISHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
RESOLVED_CLOSE=$(( $(date +%s) + 60 ))
WON_METADATA="{\"title\":\"Global trade report clears its final vote\",\"summary\":\"A public trade report reached its scheduled final vote.\",\"source\":\"BBC News\",\"sourceUrl\":\"https://www.bbc.com/news/\",\"imageUrl\":\"\",\"category\":\"world\",\"publishedAt\":\"$PUBLISHED_AT\",\"question\":\"Did the trade report clear its final vote?\",\"criteria\":\"YES if BBC News confirms passage before cutoff; otherwise NO or VOID.\",\"resolutionSources\":[{\"name\":\"BBC News\",\"url\":\"https://www.bbc.com/news/\"}],\"closeAt\":$RESOLVED_CLOSE}"
LOST_METADATA="{\"title\":\"Business committee publishes its decision\",\"summary\":\"A committee published a same-day decision for market participants.\",\"source\":\"NPR\",\"sourceUrl\":\"https://www.npr.org/sections/business/\",\"imageUrl\":\"\",\"category\":\"business\",\"publishedAt\":\"$PUBLISHED_AT\",\"question\":\"Did the committee approve the proposal?\",\"criteria\":\"YES if NPR confirms approval before cutoff; otherwise NO or VOID.\",\"resolutionSources\":[{\"name\":\"NPR\",\"url\":\"https://www.npr.org/sections/business/\"}],\"closeAt\":$RESOLVED_CLOSE}"
VOID_METADATA="{\"title\":\"Science agency schedules a public update\",\"summary\":\"A public science update was scheduled for later today.\",\"source\":\"BBC News\",\"sourceUrl\":\"https://www.bbc.com/news/science_and_environment/\",\"imageUrl\":\"\",\"category\":\"science\",\"publishedAt\":\"$PUBLISHED_AT\",\"question\":\"Did the agency publish its update?\",\"criteria\":\"YES if BBC News confirms publication before cutoff; otherwise NO or VOID.\",\"resolutionSources\":[{\"name\":\"BBC News\",\"url\":\"https://www.bbc.com/news/science_and_environment/\"}],\"closeAt\":$RESOLVED_CLOSE}"

for ENTRY in \
  "theya-e2e-won|$WON_METADATA" \
  "theya-e2e-lost|$LOST_METADATA" \
  "theya-e2e-void|$VOID_METADATA"; do
  TERM=${ENTRY%%|*}
  METADATA=${ENTRY#*|}
  cast send "$CONTRACT_ADDRESS" "createMarket(bytes32,uint40,string)" \
    "$(cast keccak "$TERM")" "$RESOLVED_CLOSE" "$METADATA" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null
done

cast send "$CONTRACT_ADDRESS" "bet(uint256,uint8)" 1 1 --value 0.01ether --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null
cast send "$CONTRACT_ADDRESS" "bet(uint256,uint8)" 1 2 --value 0.01ether --rpc-url "$RPC_URL" --private-key "$SECOND_PRIVATE_KEY" >/dev/null
cast send "$CONTRACT_ADDRESS" "bet(uint256,uint8)" 2 2 --value 0.01ether --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null
cast send "$CONTRACT_ADDRESS" "bet(uint256,uint8)" 2 1 --value 0.01ether --rpc-url "$RPC_URL" --private-key "$SECOND_PRIVATE_KEY" >/dev/null
cast send "$CONTRACT_ADDRESS" "bet(uint256,uint8)" 3 1 --value 0.01ether --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null
cast rpc evm_increaseTime 61 --rpc-url "$RPC_URL" >/dev/null
cast rpc evm_mine --rpc-url "$RPC_URL" >/dev/null
for ID in 1 2 3; do
  cast send "$CONTRACT_ADDRESS" "resolve(uint256,uint8,string,bytes32,uint16)" \
    "$ID" 1 "https://www.bbc.com/news/" "$(cast keccak "resolved-evidence-$ID")" 9200 \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null
done

CLOSE_AT=$(( $(date +%s) + 3600 ))
WORLD_METADATA="{\"title\":\"World leaders prepare for a scheduled summit\",\"summary\":\"Officials published the agenda for a same-day international summit.\",\"source\":\"BBC News\",\"sourceUrl\":\"https://www.bbc.com/news/world/\",\"imageUrl\":\"\",\"category\":\"world\",\"publishedAt\":\"$PUBLISHED_AT\",\"question\":\"Will the summit publish a joint statement by cutoff?\",\"criteria\":\"YES if BBC News links the statement before cutoff; otherwise NO or VOID.\",\"resolutionSources\":[{\"name\":\"BBC News\",\"url\":\"https://www.bbc.com/news/world/\"}],\"closeAt\":$CLOSE_AT}"
POLITICS_METADATA="{\"title\":\"Lawmakers schedule a final floor vote\",\"summary\":\"The chamber scheduled a final vote on a public bill.\",\"source\":\"BBC News\",\"sourceUrl\":\"https://www.bbc.com/news/politics/\",\"imageUrl\":\"\",\"category\":\"politics\",\"publishedAt\":\"$PUBLISHED_AT\",\"question\":\"Will the chamber complete the vote by cutoff?\",\"criteria\":\"YES if BBC News confirms a final tally before cutoff; otherwise NO or VOID.\",\"resolutionSources\":[{\"name\":\"BBC News\",\"url\":\"https://www.bbc.com/news/politics/\"}],\"closeAt\":$CLOSE_AT}"
BUSINESS_METADATA="{\"title\":\"Company sets a deadline for its filing\",\"summary\":\"A listed company said it would publish an expected filing today.\",\"source\":\"NPR\",\"sourceUrl\":\"https://www.npr.org/sections/business/\",\"imageUrl\":\"\",\"category\":\"business\",\"publishedAt\":\"$PUBLISHED_AT\",\"question\":\"Will the filing appear by cutoff?\",\"criteria\":\"YES if NPR links the public filing before cutoff; otherwise NO or VOID.\",\"resolutionSources\":[{\"name\":\"NPR\",\"url\":\"https://www.npr.org/sections/business/\"}],\"closeAt\":$CLOSE_AT}"
TECH_METADATA="{\"title\":\"Technology platform announces a product release window\",\"summary\":\"A platform published a same-day release window for a new feature.\",\"source\":\"NPR\",\"sourceUrl\":\"https://www.npr.org/sections/technology/\",\"imageUrl\":\"\",\"category\":\"technology\",\"publishedAt\":\"$PUBLISHED_AT\",\"question\":\"Will the feature launch by cutoff?\",\"criteria\":\"YES if NPR confirms public availability before cutoff; otherwise NO or VOID.\",\"resolutionSources\":[{\"name\":\"NPR\",\"url\":\"https://www.npr.org/sections/technology/\"}],\"closeAt\":$CLOSE_AT}"
SCIENCE_METADATA="{\"title\":\"Researchers prepare a public dataset release\",\"summary\":\"A research team scheduled a dataset publication for today.\",\"source\":\"BBC News\",\"sourceUrl\":\"https://www.bbc.com/news/science_and_environment/\",\"imageUrl\":\"\",\"category\":\"science\",\"publishedAt\":\"$PUBLISHED_AT\",\"question\":\"Will the dataset be public by cutoff?\",\"criteria\":\"YES if BBC News links the dataset before cutoff; otherwise NO or VOID.\",\"resolutionSources\":[{\"name\":\"BBC News\",\"url\":\"https://www.bbc.com/news/science_and_environment/\"}],\"closeAt\":$CLOSE_AT}"
HEALTH_METADATA="{\"title\":\"Health agency plans updated public guidance\",\"summary\":\"The agency scheduled updated guidance for release today.\",\"source\":\"BBC News\",\"sourceUrl\":\"https://www.bbc.com/news/health/\",\"imageUrl\":\"\",\"category\":\"health\",\"publishedAt\":\"$PUBLISHED_AT\",\"question\":\"Will updated guidance be published by cutoff?\",\"criteria\":\"YES if BBC News links official guidance before cutoff; otherwise NO or VOID.\",\"resolutionSources\":[{\"name\":\"BBC News\",\"url\":\"https://www.bbc.com/news/health/\"}],\"closeAt\":$CLOSE_AT}"
SPORTS_METADATA="{\"title\":\"League confirms a decision is due today\",\"summary\":\"League officials said a competition decision would arrive today.\",\"source\":\"BBC Sport\",\"sourceUrl\":\"https://www.bbc.com/sport/\",\"imageUrl\":\"\",\"category\":\"sports\",\"publishedAt\":\"$PUBLISHED_AT\",\"question\":\"Will the league publish its decision by cutoff?\",\"criteria\":\"YES if BBC Sport confirms the decision before cutoff; otherwise NO or VOID.\",\"resolutionSources\":[{\"name\":\"BBC Sport\",\"url\":\"https://www.bbc.com/sport/\"}],\"closeAt\":$CLOSE_AT}"
ENTERTAINMENT_METADATA="{\"title\":\"Studio schedules a trailer premiere\",\"summary\":\"A studio announced a same-day premiere time for its next trailer.\",\"source\":\"BBC News\",\"sourceUrl\":\"https://www.bbc.com/news/entertainment_and_arts/\",\"imageUrl\":\"\",\"category\":\"entertainment\",\"publishedAt\":\"$PUBLISHED_AT\",\"question\":\"Will the trailer premiere by cutoff?\",\"criteria\":\"YES if BBC News confirms public release before cutoff; otherwise NO or VOID.\",\"resolutionSources\":[{\"name\":\"BBC News\",\"url\":\"https://www.bbc.com/news/entertainment_and_arts/\"}],\"closeAt\":$CLOSE_AT}"
CRYPTO_METADATA="{\"title\":\"Digital asset network schedules a protocol update\",\"summary\":\"Developers published a same-day activation window for a network update.\",\"source\":\"CoinDesk\",\"sourceUrl\":\"https://www.coindesk.com/\",\"imageUrl\":\"\",\"category\":\"crypto\",\"publishedAt\":\"$PUBLISHED_AT\",\"question\":\"Will the update activate by cutoff?\",\"criteria\":\"YES if CoinDesk confirms activation before cutoff; otherwise NO or VOID.\",\"resolutionSources\":[{\"name\":\"CoinDesk\",\"url\":\"https://www.coindesk.com/\"}],\"closeAt\":$CLOSE_AT}"
TOP_METADATA="{\"title\":\"THEYA makes daily news actionable\",\"summary\":\"Categorized briefs pair trusted reporting with one transparent fixed-stake position.\",\"source\":\"THEYA Test Desk\",\"sourceUrl\":\"https://theyabrief.vercel.app/\",\"imageUrl\":\"\",\"category\":\"general\",\"publishedAt\":\"$PUBLISHED_AT\",\"question\":\"Will Monad testnet remain responsive through today’s cutoff?\",\"criteria\":\"YES if the official RPC returns a fresh block at cutoff; otherwise VOID.\",\"resolutionSources\":[{\"name\":\"Monad Docs\",\"url\":\"https://docs.monad.xyz/\"}],\"closeAt\":$CLOSE_AT}"

for ENTRY in \
  "theya-e2e-world|$WORLD_METADATA" \
  "theya-e2e-politics|$POLITICS_METADATA" \
  "theya-e2e-business|$BUSINESS_METADATA" \
  "theya-e2e-technology|$TECH_METADATA" \
  "theya-e2e-science|$SCIENCE_METADATA" \
  "theya-e2e-health|$HEALTH_METADATA" \
  "theya-e2e-sports|$SPORTS_METADATA" \
  "theya-e2e-entertainment|$ENTERTAINMENT_METADATA" \
  "theya-e2e-crypto|$CRYPTO_METADATA" \
  "theya-e2e-general|$TOP_METADATA"; do
  TERM=${ENTRY%%|*}
  METADATA=${ENTRY#*|}
  cast send "$CONTRACT_ADDRESS" \
    "createMarket(bytes32,uint40,string)" \
    "$(cast keccak "$TERM")" "$CLOSE_AT" "$METADATA" \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" >/dev/null
done
cast send "$CONTRACT_ADDRESS" "bet(uint256,uint8)" 4 1 --value 0.01ether \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null

export NEXT_PUBLIC_CONTRACT_ADDRESS="$CONTRACT_ADDRESS"
export NEXT_PUBLIC_DEPLOYMENT_BLOCK="0"
export NEXT_PUBLIC_MONAD_RPC_URL="$RPC_URL"
export MONAD_TESTNET_RPC_URL="$RPC_URL"
export NEXT_PUBLIC_AGENT_ID="7"
export NEXT_PUBLIC_APP_URL="http://127.0.0.1:3001"
export X402_PAY_TO_ADDRESS="$ACCOUNT"
export NEXT_DIST_DIR=".next-e2e"
npm run build
PORT=3001 ./node_modules/.bin/next start &
APP_PID=$!
wait "$APP_PID"
