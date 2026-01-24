/**
 * AudioManager - Web Audio API Integration
 * 
 * Manages audio file loading, playback, and frequency analysis.
 * Provides real-time audio data to shader uniforms.
 */

export interface FrequencyBand {
  minHz: number;
  maxHz: number;
}

export interface AudioNodeState {
  nodeId: string;
  audioContext: AudioContext | null;
  audioBuffer: AudioBuffer | null;
  sourceNode: AudioBufferSourceNode | null;
  analyserNode: AnalyserNode | null;
  gainNode: GainNode | null;
  isPlaying: boolean;
  startTime: number;
  currentTime: number;
  duration: number;
  frequencyData: Uint8Array | null;
  smoothedValues: Map<string, number>; // For smoothing frequency bands
}

export interface AnalyzerNodeState {
  nodeId: string;
  analyserNode: AnalyserNode | null;
  frequencyBands: FrequencyBand[];
  smoothing: number;
  fftSize: number;
  bandValues: number[];
  smoothedBandValues: number[];
}

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private audioNodes: Map<string, AudioNodeState> = new Map();
  private analyzerNodes: Map<string, AnalyzerNodeState> = new Map();
  private sampleRate: number = 44100; // Default, will be set from AudioContext
  private loadingNodes: Set<string> = new Set(); // Track nodes currently loading to prevent concurrent loads
  
  /**
   * Initialize AudioContext (must be called from user interaction)
   * Note: Does not automatically resume - call resume() after user interaction
   */
  async initialize(): Promise<void> {
    if (this.audioContext) {
      return; // Already initialized
    }
    
    // Create AudioContext (must be done in response to user interaction)
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.sampleRate = this.audioContext.sampleRate;
    
    // Don't automatically resume - browsers require user interaction
    // The context will be resumed when playAudio() is called (which should be after user interaction)
  }
  
  /**
   * Resume AudioContext (must be called after user interaction)
   */
  async resume(): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }
    
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.warn('Failed to resume AudioContext:', error);
      }
    }
  }
  
  /**
   * Load audio file for a node (from File object or URL string)
   */
  async loadAudioFile(nodeId: string, file: File | string): Promise<void> {
    // Prevent concurrent loads of the same node
    if (this.loadingNodes.has(nodeId)) {
      console.warn(`[AudioManager] Already loading audio for node ${nodeId}, skipping duplicate load`);
      return;
    }
    
    this.loadingNodes.add(nodeId);
    
    try {
      // Stop existing playback before loading new file
      this.stopAudio(nodeId);
      
      await this.initialize();
      
      if (!this.audioContext) {
        throw new Error('AudioContext not initialized');
      }
      
      let arrayBuffer: ArrayBuffer;
      
      if (file instanceof File) {
        // Read file as ArrayBuffer
        arrayBuffer = await file.arrayBuffer();
        
        // Validate File buffer immediately
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          console.error(`[AudioManager] File is empty or invalid:`, {
            fileName: file.name,
            fileSize: file.size,
            arrayBufferSize: arrayBuffer?.byteLength ?? 'null/undefined'
          });
          throw new Error(`Audio file is empty or invalid: ${file.name} (size: ${file.size} bytes)`);
        }
        
        console.log(`[AudioManager] File loaded successfully:`, {
          fileName: file.name,
          fileSize: file.size,
          arrayBufferSize: arrayBuffer.byteLength
        });
      } else {
        // Load from URL - encode the URL properly (handle spaces and special characters)
        let urlToFetch = file;
        
        // If it's a relative path (doesn't start with / or http), add a leading /
        if (!file.startsWith('/') && !file.startsWith('http://') && !file.startsWith('https://') && !file.startsWith('//')) {
          urlToFetch = '/' + file;
        }
        
        // If it's a relative path starting with /, we need to handle the base path
        if (urlToFetch.startsWith('/') && !urlToFetch.startsWith('//')) {
          // Get base path from import.meta.env.BASE_URL (Vite provides this)
          // During dev, BASE_URL is usually '/', in production it's '/shader-composer/'
          let baseUrl: string | undefined;
          try {
            // @ts-ignore - import.meta.env is provided by Vite
            baseUrl = import.meta.env?.BASE_URL;
          } catch (e) {
            // Ignore - will use fallback
          }
          
          // Fallback: check if we're in production by looking at the current path
          if (!baseUrl || baseUrl === '/' || baseUrl === '') {
            const currentPath = window.location.pathname;
            if (currentPath.startsWith('/shader-composer/')) {
              baseUrl = '/shader-composer';
            } else {
              baseUrl = '/';
            }
          }
          
          // Apply base URL if it's not just '/'
          if (baseUrl && baseUrl !== '/' && baseUrl !== '') {
            // Remove trailing slash from baseUrl and add the file path
            const cleanBase = baseUrl.replace(/\/$/, '');
            urlToFetch = cleanBase + urlToFetch;
          }
        }
        
        // Encode the URL properly - encode each path segment separately to handle spaces correctly
        // Split by /, encode each part, then rejoin
        const urlParts = urlToFetch.split('/');
        const encodedParts = urlParts.map((part, index) => {
          // Don't encode the first empty part (for absolute paths starting with /)
          if (index === 0 && part === '') return '';
          // Don't encode protocol parts (http://, https://)
          if (part.includes('://')) return part;
          // Encode each path segment (handles spaces, special chars)
          return encodeURIComponent(part);
        });
        urlToFetch = encodedParts.join('/');
        
        // Log the URL we're trying to fetch (for debugging)
        console.log(`[AudioManager] Attempting to load audio file:`, {
          original: file,
          resolved: urlToFetch,
          baseUrl: import.meta.env?.BASE_URL || 'detected from pathname',
          currentPath: window.location.pathname
        });
        
        // Try to fetch the file with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        let response: Response;
        try {
          response = await fetch(urlToFetch, { 
            signal: controller.signal,
            cache: 'no-cache' // Prevent stale cache issues
          });
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error(`Timeout loading audio file: ${file} (took longer than 30 seconds)`);
          }
          throw new Error(`Network error loading audio file: ${file} - ${fetchError.message}`);
        }
        clearTimeout(timeoutId);
        
        // If response is not OK, or if response is OK but body is empty, try fallback URLs
        // Vite serves public folder files at root, so we may need to try different paths
        const shouldTryFallback = !response.ok || (response.ok && response.headers.get('content-length') === '0');
        
        if (shouldTryFallback && urlToFetch !== file && file.startsWith('/')) {
          // Try 1: Original file path without base URL (for Vite dev server)
          const fallbackParts = file.split('/');
          const fallbackEncoded = fallbackParts.map((part, index) => {
            if (index === 0 && part === '') return '';
            return encodeURIComponent(part);
          });
          const fallbackUrl = fallbackEncoded.join('/');
          
          console.log(`[AudioManager] First attempt ${response.ok ? 'returned empty body' : `failed (${response.status})`}, trying fallback URL: ${fallbackUrl}`);
          
          const fallbackController = new AbortController();
          const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 30000);
          try {
            const fallbackResponse = await fetch(fallbackUrl, { 
              signal: fallbackController.signal,
              cache: 'no-cache'
            });
            clearTimeout(fallbackTimeoutId);
            
            // Check if fallback response is better (OK and has content)
            const fallbackContentLength = fallbackResponse.headers.get('content-length');
            const isFallbackBetter = fallbackResponse.ok && 
              fallbackContentLength !== '0' && 
              (!response.ok || (response.ok && response.headers.get('content-length') === '0'));
            
            if (isFallbackBetter) {
              response = fallbackResponse;
              urlToFetch = fallbackUrl;
              console.log(`[AudioManager] Fallback URL succeeded: ${fallbackUrl}`);
            }
          } catch (e) {
            clearTimeout(fallbackTimeoutId);
            // Ignore fallback errors, use original response
            console.warn(`[AudioManager] Fallback URL failed:`, e);
          }
        }
        
        // Log response details immediately
        const contentLength = response.headers.get('content-length');
        const contentType = response.headers.get('content-type');
        console.log(`[AudioManager] Response received:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          contentType,
          contentLength,
          url: urlToFetch
        });
        
        if (!response.ok) {
          // Try to read error body for more info
          const errorText = await response.text().catch(() => 'Unable to read error response');
          throw new Error(
            `Failed to load audio file from URL: ${file} (tried: ${urlToFetch}, status: ${response.status} ${response.statusText}). ` +
            `Response: ${errorText.substring(0, 200)}. ` +
            `Make sure the file exists and is accessible.`
          );
        }
        
        // Check content length if available - this is an early warning
        if (contentLength && parseInt(contentLength, 10) === 0) {
          console.error(`[AudioManager] Content-Length header indicates 0 bytes`);
          throw new Error(`Audio file is empty (0 bytes): ${file} (tried: ${urlToFetch}). Make sure the file exists and is not corrupted.`);
        }
        
        // Check content type to ensure it's an audio file
        if (contentType && !contentType.startsWith('audio/') && !contentType.includes('octet-stream')) {
          console.warn(`[AudioManager] Unexpected content type for audio file: ${contentType} (URL: ${urlToFetch})`);
        }
        
        // CRITICAL: Ensure response body hasn't been consumed
        if (response.bodyUsed) {
          console.error(`[AudioManager] Response body already consumed! This should not happen.`);
          throw new Error(`Response body was already consumed before reading. This indicates a bug in the code.`);
        }
        
        // Read the array buffer - this consumes the response body
        // IMPORTANT: We must read the body immediately and only once
        try {
          // Check if body is already used (shouldn't happen, but defensive)
          if (response.bodyUsed) {
            throw new Error('Response body was already consumed');
          }
          
          arrayBuffer = await response.arrayBuffer();
          
          // Verify we actually got data
          if (!arrayBuffer) {
            throw new Error('response.arrayBuffer() returned null/undefined');
          }
          
        } catch (arrayBufferError: any) {
          console.error(`[AudioManager] Failed to read response.arrayBuffer():`, {
            error: arrayBufferError?.message || String(arrayBufferError),
            errorStack: arrayBufferError?.stack,
            responseStatus: response.status,
            responseOk: response.ok,
            bodyUsed: response.bodyUsed,
            contentType,
            contentLength,
            url: urlToFetch
          });
          
          // If we got a response but can't read the body, it might be a CORS or network issue
          throw new Error(
            `Failed to read audio file response body: ${arrayBufferError?.message || String(arrayBufferError)}. ` +
            `File: ${file}, URL: ${urlToFetch}, Status: ${response.status}. ` +
            `This might be a CORS issue, network error, or the response body was already consumed. ` +
            `Check browser console and network tab for more details.`
          );
        }
        
        // Log immediately after getting arrayBuffer for debugging
        const actualBufferSize = arrayBuffer?.byteLength ?? 0;
        console.log(`[AudioManager] Response arrayBuffer received:`, {
          file,
          urlToFetch,
          status: response.status,
          statusText: response.statusText,
          contentType,
          contentLength,
          expectedSize: contentLength ? parseInt(contentLength, 10) : 'unknown',
          arrayBufferExists: arrayBuffer !== null && arrayBuffer !== undefined,
          arrayBufferSize: actualBufferSize,
          arrayBufferType: typeof arrayBuffer,
          arrayBufferConstructor: arrayBuffer?.constructor?.name,
          bodyUsed: response.bodyUsed,
          sizeMismatch: contentLength && parseInt(contentLength, 10) !== actualBufferSize
        });
        
        // CRITICAL: Check if we got an empty response - this must happen immediately after arrayBuffer()
        // and before any other operations that might modify or consume the buffer
        if (!arrayBuffer) {
          console.error(`[AudioManager] arrayBuffer is null or undefined`);
          throw new Error(
            `Audio file fetch returned null/undefined ArrayBuffer: ${file} (tried: ${urlToFetch}). ` +
            `Status: ${response.status} ${response.statusText}. ` +
            `This indicates a serious fetch error.`
          );
        }
        
        // Explicit check for 0 bytes - this MUST throw if buffer is empty
        const bufferSize = arrayBuffer.byteLength;
        const expectedSize = contentLength ? parseInt(contentLength, 10) : null;
        
        // Log the values we're checking - use console.log with separate statements to ensure they're visible
        console.log(`[AudioManager] Validating buffer size - bufferSize:`, bufferSize);
        console.log(`[AudioManager] Validating buffer size - expectedSize:`, expectedSize);
        console.log(`[AudioManager] Validating buffer size - contentLength:`, contentLength);
        console.log(`[AudioManager] Validating buffer size - arrayBuffer.byteLength (direct):`, arrayBuffer.byteLength);
        
        // ABSOLUTE CHECK: If buffer is 0, throw immediately - no conditions, no exceptions
        if (arrayBuffer.byteLength === 0) {
          console.error(`[AudioManager] IMMEDIATE THROW: arrayBuffer.byteLength is 0`);
          throw new Error(`ArrayBuffer is 0 bytes - immediate throw: ${file}`);
        }
        
        // Check for size mismatch - if Content-Length says one thing but buffer is different, something is wrong
        if (expectedSize !== null && bufferSize !== expectedSize) {
          console.error(`[AudioManager] Size mismatch detected:`, {
            file,
            urlToFetch,
            expectedSize,
            actualSize: bufferSize,
            status: response.status,
            contentType,
            difference: expectedSize - bufferSize
          });
          
          // If expected size is > 0 but buffer is 0, this is a critical error
          if (expectedSize > 0 && bufferSize === 0) {
            const error = new Error(
              `Audio file response size mismatch: Content-Length header says ${expectedSize} bytes, but ArrayBuffer is ${bufferSize} bytes. ` +
              `This usually means the response body couldn't be read (CORS issue, network error, or response body was consumed). ` +
              `File: ${file}, URL: ${urlToFetch}, Status: ${response.status}. ` +
              `Check browser network tab and console for CORS or other errors.`
            );
            console.error(`[AudioManager] THROWING size mismatch error:`, error);
            throw error;
          }
        }
        
        // CRITICAL: Check for 0 bytes - this MUST throw
        // This check is ABSOLUTE - if bufferSize is 0, we MUST throw, no exceptions
        if (bufferSize === 0) {
          // Log detailed information for debugging
          const errorDetails = {
            file,
            urlToFetch,
            status: response.status,
            statusText: response.statusText,
            contentType,
            contentLength,
            expectedSize,
            arrayBufferSize: bufferSize,
            arrayBufferType: typeof arrayBuffer,
            arrayBufferConstructor: arrayBuffer.constructor.name,
            arrayBufferIsArrayBuffer: arrayBuffer instanceof ArrayBuffer,
            bodyUsed: response.bodyUsed,
            arrayBufferDirectCheck: arrayBuffer.byteLength,
            bufferSizeVariable: bufferSize
          };
          console.error(`[AudioManager] Empty response detected (0 bytes) - THROWING ERROR:`, errorDetails);
          
          // This error MUST be thrown - if we reach decodeAudioData with 0 bytes, something is very wrong
          const error = new Error(
            `Audio file fetch returned empty response (0 bytes): ${file} (tried: ${urlToFetch}). ` +
            `Status: ${response.status} ${response.statusText}, Content-Type: ${contentType || 'unknown'}, Content-Length: ${contentLength || 'unknown'}. ` +
            `Expected size: ${expectedSize || 'unknown'} bytes, Actual size: ${bufferSize} bytes. ` +
            `Direct arrayBuffer.byteLength check: ${arrayBuffer.byteLength}. ` +
            `This usually means the file doesn't exist at that path, the server returned an empty response, ` +
            `or the response body couldn't be read (CORS issue). Check the browser network tab to see what the server actually returned.`
          );
          console.error(`[AudioManager] THROWING empty buffer error (this should prevent decodeAudioData from being called):`, error);
          console.error(`[AudioManager] Error stack:`, error.stack);
          throw error;
        }
        
        // Additional explicit check using direct property access
        if (arrayBuffer.byteLength === 0) {
          console.error(`[AudioManager] SECOND CHECK: Direct arrayBuffer.byteLength is 0 - THROWING`);
          throw new Error(`ArrayBuffer is 0 bytes (direct check): ${file}`);
        }
        
        // Final sanity check - if we somehow got here with 0 bytes, something is very broken
        if (arrayBuffer.byteLength === 0) {
          console.error(`[AudioManager] CRITICAL BUG: Buffer is 0 bytes after all validation checks!`);
          throw new Error(`CRITICAL BUG: ArrayBuffer validation failed - buffer is 0 bytes but all checks passed. This should be impossible.`);
        }
        
        // Additional sanity check - if we somehow got here with 0 bytes, something is broken
        if (arrayBuffer.byteLength === 0) {
          console.error(`[AudioManager] CRITICAL: Buffer is 0 bytes after validation check - this should be impossible!`);
          throw new Error(`CRITICAL BUG: ArrayBuffer validation failed - buffer is 0 bytes but check didn't catch it`);
        }
        
        // Verify we didn't get an HTML error page (only if buffer is not empty)
        if (arrayBuffer.byteLength > 0) {
          const view = new Uint8Array(arrayBuffer, 0, Math.min(100, arrayBuffer.byteLength));
          const textDecoder = new TextDecoder('utf-8', { fatal: false });
          const preview = textDecoder.decode(view);
          if (preview.trim().toLowerCase().startsWith('<!doctype') || preview.trim().toLowerCase().startsWith('<html')) {
            throw new Error(`Server returned HTML instead of audio file. URL: ${urlToFetch}. This usually means the file doesn't exist and the server returned a 404 page.`);
          }
        }
      }
      
      // CRITICAL: Final validation before decodeAudioData - this is a last line of defense
      // Double-check that arrayBuffer is valid and not empty
      if (!arrayBuffer) {
        throw new Error(`Audio file ArrayBuffer is null or undefined: ${file instanceof File ? file.name : file}`);
      }
      
      if (arrayBuffer.byteLength === 0) {
        console.error(`[AudioManager] ArrayBuffer is empty before decodeAudioData:`, {
          file: file instanceof File ? file.name : file,
          arrayBufferType: typeof arrayBuffer,
          arrayBufferConstructor: arrayBuffer.constructor.name,
          byteLength: arrayBuffer.byteLength
        });
        throw new Error(
          `Audio file is empty (0 bytes) before decoding: ${file instanceof File ? file.name : file}. ` +
          `This should have been caught earlier - there may be a bug in the validation logic.`
        );
      }
      
      // Ensure AudioContext is in a valid state
      if (!this.audioContext) {
        throw new Error('AudioContext not initialized');
      }
      
      // Check if context was closed
      if (this.audioContext.state === 'closed') {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.sampleRate = this.audioContext.sampleRate;
      }
      
      // Note: decodeAudioData works fine even when AudioContext is suspended
      // We don't need to resume here - resume will happen when playAudio() is called
      // (which requires user interaction per browser autoplay policies)
      
      // Verify context is in a valid state (not closed)
      if (this.audioContext.state === 'closed') {
        throw new Error('AudioContext is closed and cannot decode audio');
      }
      
      // Decode audio data - use the original ArrayBuffer directly (no need to slice)
      // Add one more check right before decoding as absolute final defense
      if (arrayBuffer.byteLength === 0) {
        throw new Error(
          `CRITICAL: ArrayBuffer became empty right before decodeAudioData. ` +
          `This indicates a serious bug - the buffer was validated but became empty. ` +
          `File: ${file instanceof File ? file.name : file}, Size: ${arrayBuffer.byteLength} bytes`
        );
      }
      
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      } catch (decodeError: any) {
        const errorMessage = decodeError?.message || String(decodeError);
        const contextState = this.audioContext.state;
        const bufferSize = arrayBuffer.byteLength;
        
        // Log detailed error information for debugging
        console.error(`[AudioManager] decodeAudioData failed:`, {
          error: errorMessage,
          contextState,
          bufferSize,
          file: file instanceof File ? file.name : file,
          arrayBufferType: typeof arrayBuffer,
          arrayBufferValid: arrayBuffer !== null && arrayBuffer !== undefined
        });
        
        // If buffer is empty, this is a critical error that should have been caught earlier
        if (bufferSize === 0) {
          throw new Error(
            `CRITICAL: Attempted to decode empty audio buffer (0 bytes). ` +
            `This should have been caught by validation checks. ` +
            `File: ${file instanceof File ? file.name : file}, ` +
            `AudioContext state: ${contextState}. ` +
            `This usually means the file fetch returned an empty response or the file doesn't exist.`
          );
        }
        
        // Provide detailed error information for other decode errors
        throw new Error(
          `Failed to decode audio data: ${errorMessage}. ` +
          `AudioContext state: ${contextState}, ` +
          `ArrayBuffer size: ${bufferSize} bytes, ` +
          `File: ${file instanceof File ? file.name : file}. ` +
          `The file may be corrupted, in an unsupported format, or the AudioContext may be in an invalid state.`
        );
      }
      
      // Validate decoded audio buffer
      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error(`Decoded audio buffer is empty for file: ${file instanceof File ? file.name : file}`);
      }
      
      // Create analyser node for frequency analysis (must be created before state)
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 4096; // Good resolution for frequency analysis
      analyser.smoothingTimeConstant = 0.8;
      
      // Create gain node for volume control (must be created before state)
      const gain = this.audioContext.createGain();
      gain.gain.value = 1.0;
      
      // Create state with all nodes initialized
      const frequencyDataBuffer = new ArrayBuffer(analyser.frequencyBinCount);
      const state: AudioNodeState = {
        nodeId,
        audioContext: this.audioContext,
        audioBuffer,
        sourceNode: null,
        analyserNode: analyser,
        gainNode: gain,
        isPlaying: false,
        startTime: 0,
        currentTime: 0,
        duration: audioBuffer.duration,
        frequencyData: new Uint8Array(frequencyDataBuffer),
        smoothedValues: new Map()
      };
      
      this.audioNodes.set(nodeId, state);
    } catch (error: any) {
      // Log the error with full details
      console.error(`[AudioManager] Error in loadAudioFile for node ${nodeId}:`, error);
      // Re-throw so caller can handle it
      throw error;
    } finally {
      // Remove from loading set when done (success or failure)
      this.loadingNodes.delete(nodeId);
    }
  }
  
  /**
   * Play audio for a node
   * Automatically resumes AudioContext if suspended (requires user interaction)
   */
  async playAudio(nodeId: string, offset: number = 0): Promise<void> {
    const state = this.audioNodes.get(nodeId);
    if (!state) {
      console.warn(`[AudioManager] No audio state found for node ${nodeId}. Available nodes: ${Array.from(this.audioNodes.keys()).join(', ')}`);
      return;
    }
    
    // Ensure AudioContext is initialized and resumed
    if (!this.audioContext) {
      await this.initialize();
    }
    
    if (!this.audioContext) {
      console.warn('[AudioManager] AudioContext not available');
      return;
    }
    
    // Resume context if suspended (required for autoplay policies)
    // This must be called after user interaction
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        // Verify it actually resumed
        if (this.audioContext.state === 'suspended') {
          throw new Error('AudioContext could not be resumed - user interaction required');
        }
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        // Only log if it's not the expected autoplay policy error
        if (!errorMsg.includes('user gesture') && !errorMsg.includes('user interaction') && !errorMsg.includes('not allowed to start')) {
          console.warn('[AudioManager] Failed to resume AudioContext:', error);
        }
        // Re-throw so caller knows playback failed
        throw error;
      }
    }
    
    // Check if we have an audio buffer
    if (!state.audioBuffer) {
      console.warn(`[AudioManager] No audio buffer available for node ${nodeId}`);
      return;
    }
    
    // Check if gain and analyser nodes are set up
    if (!state.gainNode || !state.analyserNode) {
      console.warn(`[AudioManager] Audio nodes not properly initialized for node ${nodeId}. gainNode: ${!!state.gainNode}, analyserNode: ${!!state.analyserNode}`);
      return;
    }
    
    // Stop existing playback if any
    this.stopAudio(nodeId);
    
    // Clamp offset to valid range
    const clampedOffset = Math.max(0, Math.min(offset, state.audioBuffer.duration));
    
    try {
      // Create new source node
      const source = this.audioContext.createBufferSource();
      source.buffer = state.audioBuffer;
      source.loop = true; // Loop playback
      
      // Connect: source -> gain -> analyser -> destination
      source.connect(state.gainNode);
      state.gainNode.connect(state.analyserNode);
      state.analyserNode.connect(this.audioContext.destination);
      
      // Start playback at offset
      state.sourceNode = source;
      state.startTime = this.audioContext.currentTime - clampedOffset;
      state.currentTime = clampedOffset;
      state.isPlaying = true;
      
      source.start(0, clampedOffset);
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      console.error(`[AudioManager] Failed to start audio playback for node ${nodeId}:`, errorMessage);
      state.isPlaying = false;
      state.sourceNode = null;
      throw error; // Re-throw so caller can handle it
    }
  }
  
  /**
   * Stop audio playback
   */
  stopAudio(nodeId: string): void {
    const state = this.audioNodes.get(nodeId);
    if (!state || !state.sourceNode) {
      return;
    }
    
    try {
      state.sourceNode.stop();
    } catch (e) {
      // Already stopped, ignore
    }
    
    state.sourceNode = null;
    state.isPlaying = false;
    state.currentTime = 0;
  }
  
  /**
   * Pause audio playback
   */
  pauseAudio(nodeId: string): void {
    this.stopAudio(nodeId);
  }
  
  /**
   * Create analyzer node
   */
  createAnalyzer(
    nodeId: string,
    audioFileNodeId: string,
    frequencyBands: FrequencyBand[],
    smoothing: number = 0.8,
    fftSize: number = 4096
  ): void {
    const audioState = this.audioNodes.get(audioFileNodeId);
    if (!audioState || !audioState.analyserNode) {
      throw new Error(`Audio file node ${audioFileNodeId} not found or not initialized`);
    }
    
    // Use the same analyser node from the audio file (shared FFT)
    const analyserState: AnalyzerNodeState = {
      nodeId,
      analyserNode: audioState.analyserNode,
      frequencyBands,
      smoothing,
      fftSize,
      bandValues: new Array(frequencyBands.length).fill(0),
      smoothedBandValues: new Array(frequencyBands.length).fill(0)
    };
    
    this.analyzerNodes.set(nodeId, analyserState);
  }
  
  /**
   * Extract frequency bands from analyser data
   */
  private extractFrequencyBands(
    frequencyData: Uint8Array,
    frequencyBands: FrequencyBand[],
    sampleRate: number,
    fftSize: number
  ): number[] {
    const bandValues: number[] = [];
    
    for (const band of frequencyBands) {
      // Convert Hz to FFT bin indices
      const minBin = Math.floor((band.minHz / sampleRate) * fftSize);
      const maxBin = Math.ceil((band.maxHz / sampleRate) * fftSize);
      
      // Sum energy in this band
      let sum = 0;
      let count = 0;
      for (let i = minBin; i <= maxBin && i < frequencyData.length; i++) {
        sum += frequencyData[i];
        count++;
      }
      
      // Normalize: 0-255 range → 0-1 range
      const average = count > 0 ? sum / count : 0;
      const normalized = average / 255.0;
      
      bandValues.push(normalized);
    }
    
    return bandValues;
  }
  
  /**
   * Update all audio uniforms (called each frame)
   */
  updateUniforms(
    setUniform: (nodeId: string, paramName: string, value: number) => void,
    setUniforms: (updates: Array<{ nodeId: string, paramName: string, value: number }>) => void
  ): void {
    // First pass: Get frequency data for all audio file nodes (FFT is expensive, do it once per node)
    // Map audio file node ID to its frequency data for reuse by analyzer nodes
    const audioFileFrequencyData = new Map<string, Uint8Array>();
    
    for (const [nodeId, state] of this.audioNodes.entries()) {
      if (!state.audioBuffer) {
        continue;
      }
      
      // Get frequency data once per audio file node (FFT is expensive)
      if (state.analyserNode && state.frequencyData) {
        state.analyserNode.getByteFrequencyData(state.frequencyData as Uint8Array<ArrayBuffer>);
        // Store for reuse by analyzer nodes that share this analyserNode
        audioFileFrequencyData.set(nodeId, state.frequencyData as Uint8Array);
      }
      
      // Update playback state
      if (state.isPlaying && this.audioContext && state.startTime > 0) {
        let elapsed = this.audioContext.currentTime - state.startTime;
        // Handle looping
        if (elapsed >= state.duration) {
          elapsed = elapsed % state.duration;
          // Restart from beginning if we've looped
          if (elapsed < 0.1) { // Small threshold to avoid rapid restarts
            state.startTime = this.audioContext.currentTime;
            elapsed = 0;
          }
        }
        state.currentTime = Math.max(0, elapsed);
      }
      
      // Set uniforms
      setUniform(nodeId, 'currentTime', state.currentTime);
      setUniform(nodeId, 'duration', state.duration);
      setUniform(nodeId, 'isPlaying', state.isPlaying ? 1.0 : 0.0);
    }
    
    // Second pass: Update analyzer node uniforms (reuse frequency data from audio file nodes)
    const analyzerUpdates: Array<{ nodeId: string, paramName: string, value: number }> = [];
    
    for (const [nodeId, analyzerState] of this.analyzerNodes.entries()) {
      if (!analyzerState.analyserNode) continue;
      
      // Find the audio file node that shares this analyserNode
      // Analyzer nodes share the analyserNode with their connected audio file node
      let frequencyData: Uint8Array | null = null;
      
      // Try to find frequency data from the connected audio file node
      for (const [audioNodeId, audioState] of this.audioNodes.entries()) {
        if (audioState.analyserNode === analyzerState.analyserNode) {
          frequencyData = audioFileFrequencyData.get(audioNodeId) || null;
          break;
        }
      }
      
      // Fallback: if we couldn't find shared data, get it directly (shouldn't happen)
      if (!frequencyData) {
        // This should be rare - analyzer nodes should share analyserNode with audio file nodes
        const buffer = new ArrayBuffer(analyzerState.analyserNode.frequencyBinCount);
        const tempFrequencyData = new Uint8Array(buffer);
        analyzerState.analyserNode.getByteFrequencyData(tempFrequencyData);
        frequencyData = tempFrequencyData;
      }
      
      // Extract frequency bands
      analyzerState.bandValues = this.extractFrequencyBands(
        frequencyData,
        analyzerState.frequencyBands,
        this.sampleRate,
        analyzerState.fftSize
      );
      
      // Apply smoothing
      for (let i = 0; i < analyzerState.bandValues.length; i++) {
        const newValue = analyzerState.bandValues[i];
        const oldValue = analyzerState.smoothedBandValues[i] || 0;
        const smoothed = analyzerState.smoothing * newValue + (1 - analyzerState.smoothing) * oldValue;
        analyzerState.smoothedBandValues[i] = smoothed;
        
        // Add uniform update
        analyzerUpdates.push({
          nodeId,
          paramName: `band${i}`,
          value: smoothed
        });
      }
    }
    
    // Batch update all analyzer uniforms
    if (analyzerUpdates.length > 0) {
      setUniforms(analyzerUpdates);
    }
  }
  
  /**
   * Get audio node state
   */
  getAudioNodeState(nodeId: string): AudioNodeState | undefined {
    return this.audioNodes.get(nodeId);
  }
  
  /**
   * Get analyzer node state
   */
  getAnalyzerNodeState(nodeId: string): AnalyzerNodeState | undefined {
    return this.analyzerNodes.get(nodeId);
  }
  
  /**
   * Play all audio nodes
   */
  async playAllAudio(offset: number = 0): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const nodeId of this.audioNodes.keys()) {
      promises.push(this.playAudio(nodeId, offset));
    }
    await Promise.all(promises);
  }
  
  /**
   * Stop all audio nodes
   */
  stopAllAudio(): void {
    for (const nodeId of this.audioNodes.keys()) {
      this.stopAudio(nodeId);
    }
  }
  
  /**
   * Get global audio state (from first loaded audio file)
   */
  getGlobalAudioState(): { isPlaying: boolean; currentTime: number; duration: number } | null {
    for (const state of this.audioNodes.values()) {
      if (state.audioBuffer) {
        let currentTime = state.currentTime;
        if (state.isPlaying && state.sourceNode && this.audioContext) {
          currentTime = (this.audioContext.currentTime - state.startTime) % state.audioBuffer.duration;
          if (currentTime < 0) currentTime = 0;
          state.currentTime = currentTime;
        }
        
        return {
          isPlaying: state.isPlaying,
          currentTime,
          duration: state.audioBuffer.duration
        };
      }
    }
    return null;
  }
  
  /**
   * Seek all audio to a specific time
   */
  async seekAllAudio(time: number): Promise<void> {
    const isPlaying = Array.from(this.audioNodes.values()).some(s => s.isPlaying);
    await this.playAllAudio(time);
    if (!isPlaying) {
      // If it wasn't playing before, stop it after seeking
      this.stopAllAudio();
    }
  }
  
  /**
   * Remove audio node
   */
  removeAudioNode(nodeId: string): void {
    this.stopAudio(nodeId);
    this.audioNodes.delete(nodeId);
  }
  
  /**
   * Remove analyzer node
   */
  removeAnalyzerNode(nodeId: string): void {
    this.analyzerNodes.delete(nodeId);
  }
  
  /**
   * Cleanup all resources
   */
  destroy(): void {
    // Stop all audio
    for (const nodeId of this.audioNodes.keys()) {
      this.stopAudio(nodeId);
    }
    
    this.audioNodes.clear();
    this.analyzerNodes.clear();
    
    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
