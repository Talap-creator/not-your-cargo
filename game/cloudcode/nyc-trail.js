// CloudCode handler for the NYCARGO «Steppe Trail» cosmetic (title QA0X2DY9).
// Publish together with any existing handlers (publishing replaces the whole revision).
// Requires: api.mainnet-beta.solana.com in the title's CloudCode outbound allow-list (Integrations).
// The wallet comes from the player's server-side record (signature-verified link), never from args.
var NYC_MINT = "5RWFPAucUS9h4bx1ApTftAWc87jVMxzPTkZwVHSeidos";
var NYC_DECIMALS = 6;
var NYC_THRESHOLD_RAW = 1000000; // 1 whole token

handlers.nycTrailBalance = function (args, context) {
  // The engine returns the sections directly ({ Blockchain: … }); older docs show a
  // { Success, Data } wrapper — accept both.
  var u = server.ReadUserData(["Blockchain"]);
  if (u && u.Success === false) return { state: "error", error: "user data: " + u.Error };
  var data = u && u.Data !== undefined ? u.Data : u;
  var bc = data && data.Blockchain;
  var w = bc && bc.LinkedWallets && bc.LinkedWallets.solana;
  if (!w || !w.Address || !w.IsSignatureVerified) return { state: "disconnected" };

  var res = server.HttpRequest({
    Method: "POST",
    Url: "https://api.mainnet-beta.solana.com",
    ContentType: "application/json",
    Body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [w.Address, { mint: NYC_MINT }, { encoding: "jsonParsed" }],
    }),
  });
  // An RPC failure is "error", never a zero balance.
  if (!res || res.Success === false) return { state: "error", error: (res && res.Error) || "no response" };
  var http = res.Data !== undefined ? res.Data : res;
  if (!http.Ok) return { state: "error", error: "RPC HTTP " + http.Status };
  var j = JSON.parse(http.Body);
  if (j.error || !j.result || !j.result.value) return { state: "error", error: (j.error && j.error.message) || "bad RPC response" };

  var raw = 0;
  for (var i = 0; i < j.result.value.length; i++) {
    var info = j.result.value[i].account.data.parsed.info;
    if (info.mint !== NYC_MINT) continue;
    if (info.tokenAmount.decimals !== NYC_DECIMALS) return { state: "error", error: "unexpected decimals" };
    raw += Number(info.tokenAmount.amount); // supply 1e15 < 2^53: exact
  }
  return { state: raw >= NYC_THRESHOLD_RAW ? "eligible" : "insufficient", address: w.Address, raw: String(raw) };
};
