import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, ExternalLink, CheckCircle, AlertCircle, Wallet, Shield } from 'lucide-react';
import { useWallet } from '../../hooks/useWallet';

interface AddToMetaMaskProps {
  className?: string;
  showTitle?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const AddToMetaMask = ({ className = '', showTitle = true, size = 'md' }: AddToMetaMaskProps) => {
  const [isCopying, setIsCopying] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { walletType, detectWalletType } = useWallet();

  const resolvedWalletType = walletType ?? (() => {
    const detected = detectWalletType?.();
    return detected && detected !== 'unknown' ? detected : null;
  })();

  const getWalletName = (type: string | null | undefined) => {
    if (type === 'safepal') {
      return 'SafePal';
    }
    if (type === 'metamask') {
      return 'MetaMask';
    }
    return 'tu wallet';
  };

  const walletName = getWalletName(resolvedWalletType);
  const renderWalletBadge = () => {
    if (resolvedWalletType === 'safepal') {
      return (
        <div className="mt-3 inline-flex items-center space-x-2 bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-xs">
          <Shield className="w-4 h-4" />
          <span>SafePal detected</span>
        </div>
      );
    }
    if (resolvedWalletType === 'metamask') {
      return (
        <div className="mt-3 inline-flex items-center space-x-2 bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-xs">
          <Wallet className="w-4 h-4" />
          <span>MetaMask detected</span>
        </div>
      );
    }
    return null;
  };

  // Token information from BSC contract
  const tokenInfo = {
    address: '0x1e2ceb5d2b4ed8077456277ba5309f950aef2ce4',
    symbol: 'GOAL',
    decimals: 7,
    image: '/assets/goalplay-icon.png'
  };

  const copyTokenDetails = async () => {
    const formattedDetails = `Token: ${tokenInfo.symbol}\nContract: ${tokenInfo.address}\nDecimals: ${tokenInfo.decimals}\nNetwork: BNB Smart Chain`;

    try {
      setIsCopying(true);
      setCopyStatus('idle');
      await navigator.clipboard.writeText(formattedDetails);
      setCopyStatus('success');
      console.log('✅ Token details copied to clipboard');
    } catch (error) {
      console.error('❌ Error copying token details:', error);
      setCopyStatus('error');
    } finally {
      setIsCopying(false);
    }
  };

  const sizeClasses = {
    sm: 'text-sm px-3 py-2',
    md: 'text-base px-4 py-3',
    lg: 'text-lg px-6 py-4'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className={className}>
      {showTitle && (
        <div className="text-center mb-6">
          <h3 className="text-xl md:text-2xl font-display font-bold gradient-text mb-2">
            Token GOAL details
          </h3>
          <p className="text-gray-400">
            Usa la información a continuación para añadir el token GOAL manualmente en {walletName}.
          </p>
          {renderWalletBadge()}
        </div>
      )}

      <div className="glass-dark rounded-xl p-6">
        {/* Token Info */}
        <div className="flex items-center space-x-4 mb-6">
          <img
            src={tokenInfo.image}
            alt="GOAL Token"
            className="w-12 h-12 rounded-full border-2 border-white/20 bg-white/10"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = target.parentElement?.querySelector('.fallback-logo') as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div className="fallback-logo hidden w-12 h-12 bg-gradient-to-r from-football-green to-football-blue rounded-full border-2 border-white/20 items-center justify-center">
            <span className="text-white font-bold text-xl">G</span>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-white text-lg">Token GOAL</div>
            <div className="text-sm text-gray-400 font-mono">
              {tokenInfo.address.slice(0, 6)}...{tokenInfo.address.slice(-4)}
            </div>
            <div className="text-sm text-football-green">BNB Smart Chain</div>
          </div>
        </div>

        {/* Contract Details */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Símbolo:</span>
            <span className="text-white font-semibold">{tokenInfo.symbol}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Decimales:</span>
            <span className="text-white font-semibold">{tokenInfo.decimals}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Red:</span>
            <span className="text-white font-semibold">BNB Smart Chain</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Contrato:</span>
            <div className="flex items-center space-x-2">
              <span className="text-white font-mono text-sm">
                {tokenInfo.address.slice(0, 10)}...{tokenInfo.address.slice(-8)}
              </span>
              <a
                href={`https://bscscan.com/token/${tokenInfo.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-football-green hover:text-football-blue transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Copy Token Details */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={copyTokenDetails}
          disabled={isCopying}
          className={`w-full btn-primary flex items-center justify-center space-x-2 ${sizeClasses[size]} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isCopying ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              <span>Copying details...</span>
            </>
          ) : (
            <>
              <Plus className={iconSizes[size]} />
              <span>Copy GOAL token info</span>
            </>
          )}
        </motion.button>

        {/* Status Messages */}
        {copyStatus === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-center"
          >
            <p className="text-green-400 text-sm">
              Datos copiados. En tu wallet, abre "Import Tokens" (por ejemplo, MetaMask → Import Token → Custom token) y pega la información.
            </p>
          </motion.div>
        )}

        {copyStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-center"
          >
            <p className="text-red-400 text-sm">
              ❌ No se pudo copiar automáticamente. Copia manualmente el contrato mostrado arriba.
            </p>
          </motion.div>
        )}

        <div className="mt-6 text-xs text-gray-500 space-y-2">
          <p>· En {walletName === 'tu wallet' ? 'tu wallet' : walletName} abre "Import Tokens" &gt; "Custom token" y pega los datos copiados.</p>
          <p>· Verifica que estés en BNB Smart Chain antes de añadir el contrato.</p>
          <p>· También puedes escribir los valores manualmente si el portapapeles no está disponible.</p>
        </div>
      </div>
    </div>
  );
};

export default AddToMetaMask;
