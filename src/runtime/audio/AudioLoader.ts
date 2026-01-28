/**
 * AudioLoader - Audio File Loading and Decoding
 * 
 * Handles loading audio files from File objects or URLs.
 * Manages URL resolution, encoding, and audio buffer decoding.
 */

import type { ErrorHandler } from '../../utils/errorHandling';
import { ErrorUtils, globalErrorHandler } from '../../utils/errorHandling';
import { BaseDisposable } from '../../utils/Disposable';
import type { AudioContextManager } from './AudioContextManager';

/**
 * Manages audio file loading and decoding.
 */
export class AudioLoader extends BaseDisposable {
  private contextManager: AudioContextManager;
  private loadingNodes: Set<string> = new Set(); // Track nodes currently loading to prevent concurrent loads
  private errorHandler?: ErrorHandler;
  
  constructor(contextManager: AudioContextManager, errorHandler?: ErrorHandler) {
    super();
    this.contextManager = contextManager;
    this.errorHandler = errorHandler;
  }
  
  /**
   * Load audio file for a node (from File object or URL string)
   */
  async loadAudioFile(nodeId: string, file: File | string): Promise<AudioBuffer> {
    this.ensureNotDestroyed();
    
    // Prevent concurrent loads of the same node
    if (this.loadingNodes.has(nodeId)) {
      const handler = this.errorHandler || globalErrorHandler;
      handler.report(
        'audio',
        'info',
        `Already loading audio for node ${nodeId}, skipping duplicate load`,
        { nodeId }
      );
      throw new Error(`Already loading audio for node ${nodeId}`);
    }
    
    this.loadingNodes.add(nodeId);
    
    try {
      await this.contextManager.initialize();
      
      const audioContext = this.contextManager.getContext();
      
      let arrayBuffer: ArrayBuffer;
      
      if (file instanceof File) {
        // Read file as ArrayBuffer
        arrayBuffer = await file.arrayBuffer();
        
        // Validate File buffer immediately
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          console.error(`[AudioLoader] File is empty or invalid:`, {
            fileName: file.name,
            fileSize: file.size,
            arrayBufferSize: arrayBuffer?.byteLength ?? 'null/undefined'
          });
          throw new Error(`Audio file is empty or invalid: ${file.name} (size: ${file.size} bytes)`);
        }
      } else {
        // Load from URL
        arrayBuffer = await this.fetchAudioFromUrl(file);
      }
      
      // Validate array buffer before decoding
      this.validateArrayBuffer(arrayBuffer, file instanceof File ? file.name : file);
      
      // Decode audio data
      const audioBuffer = await this.decodeAudioData(audioContext, arrayBuffer, nodeId, file instanceof File ? file.name : file);
      
      return audioBuffer;
    } catch (error: any) {
      // Report error via error handler (if not already reported)
      const handler = this.errorHandler || globalErrorHandler;
      const errorObj = error instanceof Error ? error : new Error(String(error));
      handler.reportError(
        ErrorUtils.audioError(
          `Error loading audio file for node ${nodeId}`,
          { originalError: errorObj, nodeId, fileName: file instanceof File ? file.name : file }
        )
      );
      // Re-throw so caller can handle it
      throw error;
    } finally {
      // Remove from loading set when done (success or failure)
      this.loadingNodes.delete(nodeId);
    }
  }
  
  /**
   * Fetch audio file from URL with proper encoding and fallback handling.
   */
  private async fetchAudioFromUrl(url: string): Promise<ArrayBuffer> {
    // Encode the URL properly (handle spaces and special characters)
    let urlToFetch = url;
    
    // If it's a relative path (doesn't start with / or http), add a leading /
    if (!url.startsWith('/') && !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//')) {
      urlToFetch = '/' + url;
    }
    
    // If it's a relative path starting with /, we need to handle the base path
    if (urlToFetch.startsWith('/') && !urlToFetch.startsWith('//')) {
      // Get base path from import.meta.env.BASE_URL (Vite provides this)
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
        // Remove trailing slash from baseUrl and add the file path; ensure result starts with /
        const cleanBase = baseUrl.replace(/\/$/, '');
        urlToFetch = (cleanBase.startsWith('/') ? cleanBase : '/' + cleanBase) + urlToFetch;
      }
    }
    
    // Encode the URL properly - encode each path segment separately to handle spaces correctly
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
    
    // Use absolute URL for same-origin paths so we always hit the right origin (fixes empty response when base path or relative resolution is wrong)
    const fetchUrl = urlToFetch.startsWith('/') && !urlToFetch.startsWith('//')
      ? window.location.origin + urlToFetch
      : urlToFetch;
    
    // Try to fetch the file with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    let response: Response;
    try {
      response = await fetch(fetchUrl, { 
        signal: controller.signal,
        cache: 'no-cache' // Prevent stale cache issues
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error(`Timeout loading audio file: ${url} (took longer than 30 seconds)`);
      }
      throw new Error(`Network error loading audio file: ${url} - ${fetchError.message}`);
    }
    clearTimeout(timeoutId);
    
    // If response is not OK, or if response is OK but body is empty, try fallback URLs
    const shouldTryFallback = !response.ok || (response.ok && response.headers.get('content-length') === '0');
    
    if (shouldTryFallback && urlToFetch !== url && url.startsWith('/')) {
      // Try fallback: Original file path without base URL (for Vite dev server)
      const fallbackParts = url.split('/');
      const fallbackEncoded = fallbackParts.map((part, index) => {
        if (index === 0 && part === '') return '';
        return encodeURIComponent(part);
      });
      const fallbackUrl = fallbackEncoded.join('/');
      const fallbackFetchUrl = fallbackUrl.startsWith('/') && !fallbackUrl.startsWith('//')
        ? window.location.origin + fallbackUrl
        : fallbackUrl;
      
      const fallbackController = new AbortController();
      const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 30000);
      try {
        const fallbackResponse = await fetch(fallbackFetchUrl, { 
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
        }
      } catch (e) {
        clearTimeout(fallbackTimeoutId);
        // Ignore fallback errors, use original response
        console.warn(`[AudioLoader] Fallback URL failed:`, e);
      }
    }
    
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');
    
    if (!response.ok) {
      // Try to read error body for more info
      const errorText = await response.text().catch(() => 'Unable to read error response');
      throw new Error(
        `Failed to load audio file from URL: ${url} (tried: ${urlToFetch}, status: ${response.status} ${response.statusText}). ` +
        `Response: ${errorText.substring(0, 200)}. ` +
        `Make sure the file exists and is accessible.`
      );
    }
    
    // Check content length if available - this is an early warning
    if (contentLength && parseInt(contentLength, 10) === 0) {
      console.error(`[AudioLoader] Content-Length header indicates 0 bytes`);
      throw new Error(`Audio file is empty (0 bytes): ${url} (tried: ${urlToFetch}). Make sure the file exists and is not corrupted.`);
    }
    
    // Check content type to ensure it's an audio file
    if (contentType && !contentType.startsWith('audio/') && !contentType.includes('octet-stream')) {
      console.warn(`[AudioLoader] Unexpected content type for audio file: ${contentType} (URL: ${urlToFetch})`);
    }
    
    // CRITICAL: Ensure response body hasn't been consumed
    if (response.bodyUsed) {
      console.error(`[AudioLoader] Response body already consumed! This should not happen.`);
      throw new Error(`Response body was already consumed before reading. This indicates a bug in the code.`);
    }
    
    // Read the array buffer - this consumes the response body
    try {
      if (response.bodyUsed) {
        throw new Error('Response body was already consumed');
      }
      
      const buffer = await response.arrayBuffer();
      
      // Verify we actually got data
      if (!buffer) {
        throw new Error('response.arrayBuffer() returned null/undefined');
      }
      
      return buffer;
    } catch (arrayBufferError: any) {
      console.error(`[AudioLoader] Failed to read response.arrayBuffer():`, {
        error: arrayBufferError?.message || String(arrayBufferError),
        errorStack: arrayBufferError?.stack,
        responseStatus: response.status,
        responseOk: response.ok,
        bodyUsed: response.bodyUsed,
        contentType,
        contentLength,
        url: urlToFetch
      });
      
      throw new Error(
        `Failed to read audio file response body: ${arrayBufferError?.message || String(arrayBufferError)}. ` +
        `File: ${url}, URL: ${urlToFetch}, Status: ${response.status}. ` +
        `This might be a CORS issue, network error, or the response body was already consumed.`
      );
    }
  }
  
  /**
   * Validate array buffer before decoding.
   */
  private validateArrayBuffer(arrayBuffer: ArrayBuffer, fileName: string): void {
    if (!arrayBuffer) {
      throw new Error(`Audio file ArrayBuffer is null or undefined: ${fileName}`);
    }
    
    if (arrayBuffer.byteLength === 0) {
      console.error(`[AudioLoader] ArrayBuffer is empty:`, {
        fileName,
        arrayBufferType: typeof arrayBuffer,
        arrayBufferConstructor: arrayBuffer.constructor.name,
        byteLength: arrayBuffer.byteLength
      });
      throw new Error(
        `Audio file is empty (0 bytes): ${fileName}. ` +
        `This usually means the file doesn't exist at that path, the server returned an empty response, ` +
        `or the response body couldn't be read (CORS issue). Check the browser network tab to see what the server actually returned.`
      );
    }
    
    // Verify we didn't get an HTML error page
    if (arrayBuffer.byteLength > 0) {
      const view = new Uint8Array(arrayBuffer, 0, Math.min(100, arrayBuffer.byteLength));
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      const preview = textDecoder.decode(view);
      if (preview.trim().toLowerCase().startsWith('<!doctype') || preview.trim().toLowerCase().startsWith('<html')) {
        throw new Error(`Server returned HTML instead of audio file. File: ${fileName}. This usually means the file doesn't exist and the server returned a 404 page.`);
      }
    }
  }
  
  /**
   * Decode audio data from array buffer.
   */
  private async decodeAudioData(
    audioContext: AudioContext,
    arrayBuffer: ArrayBuffer,
    nodeId: string,
    fileName: string
  ): Promise<AudioBuffer> {
    // Ensure context is in a valid state (not closed)
    if (audioContext.state === 'closed') {
      throw new Error('AudioContext is closed and cannot decode audio');
    }
    
    // Final validation before decoding
    if (arrayBuffer.byteLength === 0) {
      throw new Error(
        `CRITICAL: ArrayBuffer became empty right before decodeAudioData. ` +
        `This indicates a serious bug - the buffer was validated but became empty. ` +
        `File: ${fileName}, Size: ${arrayBuffer.byteLength} bytes`
      );
    }
    
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (decodeError: any) {
      const errorMessage = decodeError?.message || String(decodeError);
      const contextState = audioContext.state;
      const bufferSize = arrayBuffer.byteLength;
      
      // Report error via error handler
      const handler = this.errorHandler || globalErrorHandler;
      
      // If buffer is empty, the fetch returned no data (wrong path, 404 as 200, or server issue)
      if (bufferSize === 0) {
        const error = new Error(
          `Audio file empty or not found (0 bytes). ` +
          `File: ${fileName}. ` +
          `Check that the file exists in public/ and the path is correct.`
        );
        handler.report(
          'audio',
          'warning',
          `Failed to load audio: file empty or not found`,
          { originalError: error, nodeId, fileName, contextState, bufferSize }
        );
        throw error;
      }
      
      // Provide detailed error information for other decode errors
      const error = new Error(
        `Failed to decode audio data: ${errorMessage}. ` +
        `AudioContext state: ${contextState}, ` +
        `ArrayBuffer size: ${bufferSize} bytes, ` +
        `File: ${fileName}. ` +
        `The file may be corrupted, in an unsupported format, or the AudioContext may be in an invalid state.`
      );
      handler.reportError(
        ErrorUtils.audioError(
          `Failed to decode audio data: ${errorMessage}`,
          { originalError: error, nodeId, fileName, contextState, bufferSize }
        )
      );
      throw error;
    }
    
    // Validate decoded audio buffer
    if (!audioBuffer || audioBuffer.length === 0) {
      const handler = this.errorHandler || globalErrorHandler;
      const error = new Error(`Decoded audio buffer is empty for file: ${fileName}`);
      handler.reportError(
        ErrorUtils.audioError(
          `Decoded audio buffer is empty`,
          { originalError: error, nodeId, fileName }
        )
      );
      throw error;
    }
    
    return audioBuffer;
  }
  
  /**
   * Clean up resources.
   */
  protected doDestroy(): void {
    // Clear loading set
    this.loadingNodes.clear();
  }
}
