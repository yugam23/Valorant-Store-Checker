import { WalletDisplay } from "@/components/store/WalletDisplay";
import { getWallet } from "@/lib/store-service";
import { StoreTokens } from "@/lib/riot-store";

interface WalletSectionProps {
  session: StoreTokens;
}

export async function WalletSection({ session }: WalletSectionProps) {
  const wallet = await getWallet(session);

  return (
    <WalletDisplay wallet={{
      vp: wallet.Balances["85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741"] || 0,
      rp: wallet.Balances["e59aa87c-4cbf-517a-5983-6e81511be9b7"] || 0,
      kc: wallet.Balances["85ca954a-41f2-ce94-9b45-8ca3dd39a00d"] || 0,
    }} />
  );
}
