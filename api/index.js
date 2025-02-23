const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { Innertube } = require('youtubei.js');

const app = express();

// Enable CORS for all origins
app.use(cors());

const CHANNEL_IDS = [
    'UCyBzV_g6Vfv5GM3aMQb3Y_A',
    'UCrB8j1YCbuYhIcImwNkJgCg',
    'UCPGNioeYrJq4nyAt-DVIHZg',
    'UCEEi1lDCkKi1ukmTAgc9-zA',
    'UCVIq229U5A54UVzHQJqZCPQ',
    'UCcKMjICfQPjiVMpqS-yF7hA',
    'UCWcQCJHYOK2ZZRA2Sym0mOw',
    'UCn372MiubHTkPFwxKVv45LQ',
    'UCUF0EGa7_yM4TXQl4LYt-YA',
];

// Initialize YouTube client as a promise
const youtubeClientPromise = Innertube.create();
let youtubeClient = null;

// Helper function to ensure YouTube client is initialized
async function getYoutubeClient() {
    if (!youtubeClient) {
        youtubeClient = await youtubeClientPromise;
    }
    return youtubeClient;
}

// Helper function to search a single channel using youtubei.js
async function searchChannel(channelId, query) {
    try {
        const youtube = await getYoutubeClient();
        const channel = await youtube.getChannel(channelId);
        const searchResults = await channel.search(query, {
            type: 'video',
            limit: 5
        });

        return searchResults.videos.map(video => ({
            id: { videoId: video.id },
            snippet: {
                title: video.title.text,
                description: video.description?.text || '',
                channelTitle: video.author.name,
                channelId: video.author.id,
                publishedAt: video.published.text,
                thumbnails: video.thumbnails
            }
        }));
    } catch (error) {
        console.error(`Error searching channel ${channelId}:`, error);
        return [];
    }
}

app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        
        if (!query) {
            return res.status(400).json({
                error: 'Query parameter is required',
                code: 'MISSING_QUERY'
            });
        }

        // Ensure YouTube client is initialized before searching
        await getYoutubeClient();

        // Search all channels
        const results = await Promise.allSettled(
            CHANNEL_IDS.map(channelId => searchChannel(channelId, query))
        );

        // Rest of the search endpoint code remains the same
        const validResults = results
            .filter(result => result.status === 'fulfilled')
            .flatMap(result => result.value);

        if (validResults.length === 0) {
            return res.status(404).json({
                error: 'No results found',
                code: 'NO_RESULTS'
            });
        }

        const transformedResults = validResults.map(item => ({
            type: 'stream',
            url: `/watch?v=${item.id.videoId}`,
            title: item.snippet.title,
            thumbnail: `https://pol1.piproxy.ggtyler.dev/vi/${item.id.videoId}?host=i.ytimg.com` || '',
            uploaderName: item.snippet.channelTitle,
            uploaderUrl: `/channel/${item.snippet.channelId}`,
            uploadedDate: item.snippet.publishedAt,
            duration: null,
            views: null,
            uploaderVerified: false,
            shortDescription: item.snippet.description,
            uploaded: Date.now() / 1000,
            uploaderAvatar: null,
            isShort: false
        }))
        .filter(result => result.url && result.title);

        transformedResults.sort((a, b) => (b.uploaded || 0) - (a.uploaded || 0));

        res.json({
            items: transformedResults,
            message: 'Success',
            code: 'OK'
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            code: 'INTERNAL_ERROR'
        });
    }
});

app.get('/api/streams/:videoId', async (req, res) => {
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

app.get('/api/channel/:id', async (req, res) => {
    try {
        const channelId = req.params.id;
        const response = await axios.get(`https://pol1.piapi.ggtyler.dev/channel/${channelId}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error in /channel endpoint:', error);
        res.status(500).json({
            error: 'Failed to fetch channel data',
            message: error.message
        });
    }
});

app.get('/api/list/:channelId', async (req, res) => {
    try {
        const channelId = req.params.channelId;
        
        const channelData = await getAllChannelVideos(channelId);
        
        if (!channelData || channelData.status !== 'ok') {
            throw new Error('Failed to fetch channel data');
        }

        res.json({
            channelId,
            totalVideos: channelData.stats.totalVideos,
            fetchedVideos: channelData.stats.fetchedVideos,
            filteredVideos: channelData.videos.length,
            videos: channelData.videos
        });
    } catch (error) {
        console.error('Error in /list endpoint:', error);
        res.status(500).json({
            error: 'Failed to fetch channel data',
            message: error.message
        });
    }
});

app.get('/api/nextpage/:token', async (req, res) => {
    try {
        const nextPageToken = req.params.token;
        
        if (!nextPageToken) {
            return res.status(400).json({
                error: 'Next page token is required',
                code: 'MISSING_TOKEN'
            });
        }

        const response = await axios.get(`https://pol1.piapi.ggtyler.dev/nextpage/${nextPageToken}`);
        
        const transformedResponse = {
            ...response.data,
            code: 'OK',
            message: 'Success'
        };

        res.json(transformedResponse);

    } catch (error) {
        console.error('Error in /nextpage endpoint:', error);
        res.status(500).json({
            error: 'Failed to fetch next page data',
            message: error.message,
            code: 'INTERNAL_ERROR'
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Unexpected error occurred',
        message: err.message,
        code: 'UNHANDLED_ERROR'
    });
});

// Export the Express app
module.exports = app;