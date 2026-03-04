import { WalletDisplay } from "@/components/store/WalletDisplay";
import { getWallet } from "@/lib/store-service";
import { StoreTokens } from "@/lib/riot-store";
import { CURRENCY_IDS } from "@/types/riot";

interface WalletSectionProps {
  session: StoreTokens;
}

export async function WalletSection({ session }: WalletSectionProps) {
  const wallet = await getWallet(session);

  return (
    <WalletDisplay wallet={{
      vp: wallet?.Balances[CURRENCY_IDS.VP] || 0,
      rp: wallet?.Balances[CURRENCY_IDS.RP] || 0,
      kc: wallet?.Balances[CURRENCY_IDS.KC] || 0,
    }} />
  );
}
