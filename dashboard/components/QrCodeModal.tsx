import React, { useState, useEffect } from 'react';
import Modal from './common/Modal';
import Spinner from './common/Spinner';
import { QRCodeSVG } from 'qrcode.react';
import { getQrCodeData } from '../services/api';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
}

const QrCodeModal: React.FC<QrCodeModalProps> = ({ isOpen, onClose, deviceId }) => {
    const [qrData, setQrData] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && deviceId) {
            setLoading(true);
            setError(null);
            setQrData(null);
            getQrCodeData(deviceId)
                .then(data => setQrData(data.qrCodeData))
                .catch(err => {
                    if (err instanceof Error) {
                        setError(err.message);
                    } else {
                        setError('An unknown error occurred while fetching QR data.');
                    }
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, deviceId]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Provision Device via QR Code">
            <div className="text-center">
                {loading && <Spinner size="lg" />}
                {error && <p className="bg-rose-900/50 text-rose-300 border border-rose-500/30 p-3 rounded-md text-center">{error}</p>}
                {qrData && (
                    <div className="flex flex-col items-center gap-4">
                        <p className="text-slate-400">
                            Scan this on a new or factory-reset phone.
                            <strong> Tap the 'Welcome' screen 7 times</strong> to activate the scanner.
                        </p>
                        <div className="bg-white p-4 inline-block rounded-lg">
                            <QRCodeSVG value={qrData} size={256} />
                        </div>
                         <p className="text-xs text-slate-500">This will automatically install and secure the device.</p>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default QrCodeModal;
