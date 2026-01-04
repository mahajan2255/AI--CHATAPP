import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Peer from 'peerjs';

export const useWebRTC = (socket, user, currentChat, isGroupCall = false) => {
    const peerInstance = useRef(null);
    const localStream = useRef(null);
    const remoteStreams = useRef({}); // { peerId: MediaStream }
    const callRefs = useRef({}); // { peerId: Call } (MediaConnection)

    const [connectedPeers, setConnectedPeers] = useState([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [myPeerId, setMyPeerId] = useState(null);

    // Initialize PeerJS
    useEffect(() => {
        if (!user) return;

        // Initialize Peer (let PeerJS generate a unique ID)
        const peer = new Peer(undefined, {
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            },
            debug: 2
        });

        peer.on('open', (id) => {
            console.log('My PeerJS ID:', id);
            setMyPeerId(id);
        });

        // Handle incoming calls
        peer.on('call', (call) => {
            console.log('Incoming PeerJS call from:', call.peer);

            // If we have a local stream (meaning we accepted a call or started one), answer it.
            if (localStream.current) {
                console.log('Answering call automatically with local stream');
                call.answer(localStream.current);
                handleCallStream(call);
            } else {
                console.warn('Received call but no local stream ready. Ignoring (or implement queuing).');
                // Could store call to answer later, but socket flow ensures we usually have stream ready.
            }
        });

        peer.on('error', (err) => {
            console.error('PeerJS error:', err);
        });

        peerInstance.current = peer;

        return () => {
            peer.destroy();
            peerInstance.current = null;
            remoteStreams.current = {};
            setConnectedPeers([]);
        };
    }, [user]);

    // Handle stream from a call (MediaConnection)
    const handleCallStream = (call) => {
        // Store call reference
        callRefs.current[call.peer] = call;

        call.on('stream', (remoteStream) => {
            console.log('Received remote stream from:', call.peer);
            remoteStreams.current[call.peer] = remoteStream;
            setConnectedPeers(prev => [...new Set([...prev, call.peer])]);
        });

        call.on('close', () => {
            console.log('Call closed with:', call.peer);
            removePeer(call.peer);
        });

        call.on('error', (err) => {
            console.error('Call error:', err);
            removePeer(call.peer);
        });
    };

    // Get user media
    const getUserMedia = useCallback(async (isVideoCall = false) => {
        try {
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: isVideoCall ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                } : false
            };

            // If we already have a stream, stop it? Or reuse?
            // Usually start new one for mode switch.
            if (localStream.current) {
                localStream.current.getTracks().forEach(t => t.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStream.current = stream;

            // Sync mute/camera state
            setIsMuted(false);
            setIsCameraOff(false);

            return stream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    }, []);

    // Connect to a peer (Caller initiates)
    const connectToPeer = useCallback((peerId) => {
        if (!peerInstance.current || !localStream.current) {
            console.warn('Cannot connect: Peer not ready or no local stream');
            return;
        }

        console.log('Calling peer:', peerId);
        const call = peerInstance.current.call(String(peerId), localStream.current);

        if (call) {
            handleCallStream(call);
        } else {
            console.error('PeerJS call failed to initialize');
        }
    }, []);

    const removePeer = useCallback((peerId) => {
        if (callRefs.current[peerId]) {
            callRefs.current[peerId].close();
            delete callRefs.current[peerId];
        }
        delete remoteStreams.current[peerId];
        setConnectedPeers(prev => prev.filter(p => p !== peerId));
    }, []);

    const toggleMute = useCallback(() => {
        if (localStream.current) {
            const track = localStream.current.getAudioTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                setIsMuted(!track.enabled);
            }
        }
    }, []);

    const toggleCamera = useCallback(() => {
        if (localStream.current) {
            const track = localStream.current.getVideoTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                setIsCameraOff(!track.enabled);
            }
        }
    }, []);

    const cleanup = useCallback(() => {
        if (localStream.current) {
            localStream.current.getTracks().forEach(t => t.stop());
            localStream.current = null;
        }
        Object.values(callRefs.current).forEach(call => call.close());
        callRefs.current = {};
        remoteStreams.current = {};
        setConnectedPeers([]);
    }, []);

    return useMemo(() => ({
        localStream,
        remoteStreams,
        connectedPeers,
        isMuted,
        isCameraOff,
        myPeerId,
        getUserMedia,
        connectToPeer,
        toggleMute,
        toggleCamera,
        cleanup
    }), [connectedPeers, isMuted, isCameraOff, myPeerId, getUserMedia, connectToPeer, toggleMute, toggleCamera, cleanup]);
};
