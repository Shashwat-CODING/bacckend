const express = require('express');
const axios = require('axios');

const app = express();
const PIPED_API_BASE = 'https://nyc1.piapi.ggtyler.dev';
const BACKEND_API = 'https://backendmix.vercel.app';
const YOUTUBE_API_KEY = 'AIzaSyB7R3K2YSO3Rej5TKEHhGPCq0S68SQ9dLg';

const youtubeClient = axios.create({
    baseURL: 'https://www.googleapis.com/youtube/v3',
    params: {
        key: YOUTUBE_API_KEY
    }
});

// Configure RapidAPI client
const rapidApiClient = axios.create({
    baseURL: 'https://youtube-mp36.p.rapidapi.com',
    headers: {
        'X-RapidAPI-Key': 'eee55a9833msh8f2dbd8e2b7970bp194fefjsne09ddc646e78',
        'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com'
    }
});

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Helper function to fetch channel info from Piped API
const getChannelInfo = async (channelId) => {
    try {
        const response = await axios.get(`${PIPED_API_BASE}/channel/${channelId}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching channel info for "${channelId}":`, error);
        throw error;
    }
};

// Helper function to fetch channel videos from new backend API
const getChannelVideos = async (channelId) => {
    try {
        const response = await axios.get(`${BACKEND_API}/c/${channelId}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching channel videos for "${channelId}":`, error);
        throw error;
    }
};

// Helper function to fetch paginated channel videos from Piped API
const getChannelVideosPiped = async (channelId, nextpage = null) => {
    try {
        const response = await axios.get(`${PIPED_API_BASE}/channel/${channelId}`, {
            params: { nextpage }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching channel videos for "${channelId}":`, error);
        throw error;
    }
};

// New channel endpoint
app.get('/channel/:id', async (req, res) => {
    try {
        const channelId = req.params.id;
        const maxDuration = 7200; // 42 minutes in seconds
        let allVideos = [];
        let nextpage = null;
        let channelInfo = null;

        // Get initial channel info
        channelInfo = await getChannelInfo(channelId);
        
        // Fetch all videos with pagination
        do {
            const response = await getChannelVideosPiped(channelId, nextpage);
            
            if (response.relatedStreams) {
                // Filter videos based on duration
                const filteredVideos = response.relatedStreams.filter(video => {
                    const durationInSeconds = video.duration;
                    return durationInSeconds <= maxDuration;
                });
                
                allVideos = allVideos.concat(filteredVideos);
            }

            nextpage = response.nextpage;
            
            // Add delay to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
            
        } while (nextpage);

        // Prepare response
        const response = {
            channelInfo: {
                name: channelInfo.name,
                description: channelInfo.description,
                subscriberCount: channelInfo.subscriberCount,
                thumbnailUrl: channelInfo.thumbnailUrl
            },
            totalVideos: allVideos.length,
            videos: allVideos.map(video => ({
                id: video.url.split('v=')[1],
                title: video.title,
                duration: video.duration,
                uploadDate: video.uploadDate,
                views: video.views,
                thumbnailUrl: video.thumbnailUrl
            }))
        };

        res.json(response);
    } catch (error) {
        console.error('Error in /channel endpoint:', error);
        res.status(500).json({
            error: 'Failed to fetch channel data',
            message: error.message
        });
    }
});

// Helper function to fetch search results from Piped API
const searchPipedPaginated = async (query, maxResults = 50) => {
    let allResults = [];
    let nextPage = null;

    try {
        while (allResults.length < maxResults) {
            const response = await axios.get(`${PIPED_API_BASE}/search`, {
                params: { q: query, filter: 'videos', page: nextPage }
            });

            if (response.data.items) {
                allResults = allResults.concat(response.data.items);
            }

            nextPage = response.data.nextpage;
            if (!nextPage) break;
        }
    } catch (error) {
        console.error(`Error fetching paginated Piped search results for "${query}":`, error);
    }

    return allResults.slice(0, maxResults);
};

// Helper function to shuffle results
const shuffleArray = (array) => {
    return array.sort(() => Math.random() - 0.5);
};

// Search endpoint
app.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        const maxResults = parseInt(req.query.maxResults) || 50;

        if (!query) {
            return res.status(400).json({ error: 'Missing search query' });
        }

        const searchResults1 = await searchPipedPaginated(`${query} sr pay stories`, maxResults);
        const searchResults2 = await searchPipedPaginated(`${query} Alpha akki dark`, maxResults);
        const searchResults3 = await searchPipedPaginated(`${query} Alpha akki`, maxResults);
        const searchResults4 = await searchPipedPaginated(`${query} Shivam is on`, maxResults);
        const searchResults5 = await searchPipedPaginated(`${query} thrill tales`, maxResults);
        const searchResults6 = await searchPipedPaginated(`${query} Amaan parkar`, maxResults);

        let filteredResults = [...searchResults1, ...searchResults2, ...searchResults3, ...searchResults4, ...searchResults5,  ...searchResults6].filter(
            video => video.uploaderName === 'Alpha Akki Dark' || 
                    video.uploaderName === 'SR PAY STORIES' || 
                    video.uploaderName === 'Alpha Akki' || 
                    video.uploaderName === 'ShivamIsOn' || 
                    video.uploaderName === 'Thrill Tales' ||
                    video.uploaderName === 'Amaan parkar'
        );

        filteredResults = shuffleArray(filteredResults).slice(0, maxResults);

        res.json({ items: filteredResults });
    } catch (error) {
        console.error('Error processing search request:', error);
        res.status(500).json({ error: 'Failed to fetch search results' });
    }
});

// Streams endpoint
app.get('/streams/:videoId', async (req, res) => {
    try {
        const videoId = req.params.videoId;
        const sources = [
            'https://raw.githubusercontent.com/Shashwat-CODER-Music/akkidark/refs/heads/main/downloads.json',
            'https://raw.githubusercontent.com/Studyleague01/srpay/refs/heads/main/downloads.json',
            'https://raw.githubusercontent.com/Shashwat-CODING/akki/refs/heads/main/downloads.json',
            'https://raw.githubusercontent.com/Scodify236/sio/refs/heads/main/downloads.json',
            'https://raw.githubusercontent.com/1fffd/thrilltales/refs/heads/main/downloads.json',
            'https://raw.githubusercontent.com/Studyleague01/amanpar/refs/heads/main/downloads.json',
        ];

        let videoData = null;

        for (const source of sources) {
            try {
                const response = await axios.get(source);
                if (response.data[videoId]) {
                    videoData = response.data[videoId];
                    break;
                }
            } catch (sourceError) {
                console.error(`Error fetching from source ${source}:`, sourceError);
                continue;
            }
        }

        if (!videoData) {
            return res.status(404).json({ error: 'Video not found' });
        }

        res.json({
            title: videoData.title,
            uploader: 'Podcast heaven',
            uploaderUrl: 'null',
            duration: 0,
            audioStreams: [
                {
                    url: videoData.filePath,
                    quality: '320 kbps',
                    mimeType: 'audio/webm; codecs="opus"',
                    codec: 'opus',
                    bitrate: 145140,
                    contentLength: videoData.size,
                    audioQuality: 'AUDIO_QUALITY_HIGH'
                }
            ]
        });
    } catch (error) {
        console.error('Error fetching stream details:', error);
        res.status(500).json({ error: 'Failed to fetch stream data' });
    }
});

// Simple channel endpoint that just forwards Piped API response
app.get('/channel/:id', async (req, res) => {
    try {
        const channelId = req.params.id;
        const response = await axios.get(`${PIPED_API_BASE}/channel/${channelId}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error in /channel endpoint:', error);
        res.status(500).json({
            error: 'Failed to fetch channel data',
            message: error.message
        });
    }
});

// List endpoint with no filters
app.get('/list/:channelId', async (req, res) => {
    try {
        const channelId = req.params.channelId;
        
        // Fetch channel data from new API
        const channelData = await getChannelVideos(channelId);
        
        if (!channelData || channelData.status !== 'ok') {
            throw new Error('Failed to fetch channel data');
        }

        // Get all video IDs without filtering
        const allVideos = channelData.videos.map(video => video.id);

        // Prepare response
        res.json({
            channelId,
            totalVideos: channelData.stats.totalVideos,
            fetchedVideos: channelData.stats.totalVideos,
            filteredVideos: allVideos.length,
            videos: allVideos
        });
    } catch (error) {
        console.error('Error in /list endpoint:', error);
        res.status(500).json({
            error: 'Failed to fetch channel data',
            message: error.message
        });
    }
});

// Download endpoint
app.get('/d/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        if (!videoId || videoId.length < 5) {
            return res.status(400).json({ error: 'Invalid video ID' });
        }
        
        const result = await rapidApiClient.get('/dl', { params: { id: videoId } });
        res.json(result.data);
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Failed to get download URL', message: error.message });
    }
});

// Home route
app.get('/', (req, res) => {
    res.json({ 
        message: 'YouTube MP3 Downloader API',
        usage: {
            download: 'GET /d/{youtube-video-id}',
            listVideos: 'GET /list/{channel-id}',
            search: 'GET /search?q={query}',
            streamDetails: 'GET /streams/{videoId}',
            channelInfo: 'GET /channel/{channel-id}'
        }
    });
});

module.exports = app;