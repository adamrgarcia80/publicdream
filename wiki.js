async function getWikipediaExtract(wikipediaTitle) {
  try {
    const encodedTitle = encodeURIComponent(wikipediaTitle);
    // Fetch full article instead of just intro for more content
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=false&explaintext=true&exchars=5000&titles=${encodedTitle}&format=json&origin=*`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PublicDream/1.0 (https://publicdream.world)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }
    
    const data = await response.json();
    const pages = data.query?.pages;
    
    if (!pages) {
      return null;
    }
    
    // Get the first page (usually there's only one)
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];
    
    return page?.extract || null;
  } catch (error) {
    console.error('Error fetching Wikipedia extract:', error);
    return null;
  }
}

// Fetch extract plus a lead image thumbnail and caption, for richer myth pages
async function getWikipediaExtractWithImage(wikipediaTitle) {
  try {
    const encodedTitle = encodeURIComponent(wikipediaTitle);
    // First get the page with image
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=false&explaintext=true&exchars=5000&piprop=thumbnail&pithumbsize=600&titles=${encodedTitle}&format=json&origin=*`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PublicDream/1.0 (https://publicdream.world)',
      },
    });

    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }

    const data = await response.json();
    const pages = data.query?.pages;

    if (!pages) {
      return { extract: null, imageUrl: null, imageCaption: null };
    }

    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];

    const extract = page?.extract || null;
    const imageUrl = page?.thumbnail?.source || null;
    let imageCaption = null;

    // If we have an image, fetch its caption from the File page
    if (imageUrl && page.thumbnail) {
      try {
        // Extract filename from thumbnail URL
        // Format: https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Filename.jpg/600px-Filename.jpg
        const urlParts = page.thumbnail.source.split('/');
        const filenameWithSize = urlParts[urlParts.length - 1];
        // Remove size prefix (e.g., "600px-")
        const cleanFilename = filenameWithSize.replace(/^\d+px-/, '');
        
        // Query the File page for image metadata
        const imageInfoUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(cleanFilename)}&prop=imageinfo&iiprop=extmetadata&format=json&origin=*`;
        
        const imageResponse = await fetch(imageInfoUrl, {
          headers: {
            'User-Agent': 'PublicDream/1.0 (https://publicdream.world)',
          },
        });
        
        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          const imagePages = imageData.query?.pages;
          if (imagePages) {
            const imgPageId = Object.keys(imagePages)[0];
            const imgPage = imagePages[imgPageId];
            if (imgPage?.imageinfo?.[0]?.extmetadata?.['ImageDescription']?.value) {
              // Remove HTML tags and decode entities from caption
              imageCaption = imgPage.imageinfo[0].extmetadata['ImageDescription'].value
                .replace(/<[^>]*>/g, '')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .trim();
            }
          }
        }
      } catch (e) {
        // If caption fetch fails, continue without it
        console.log('Could not fetch image caption:', e);
      }
    }

    return { extract, imageUrl, imageCaption };
  } catch (error) {
    console.error('Error fetching Wikipedia extract with image:', error);
    return { extract: null, imageUrl: null, imageCaption: null };
  }
}

// Fetch additional content from Wikipedia related pages
async function getWikipediaRelatedContent(mainTitle, relatedTitles = []) {
  try {
    // Fetch main article
    const mainContent = await getWikipediaExtract(mainTitle);
    
    // If we have related titles, fetch those too
    if (relatedTitles.length > 0) {
      const relatedContents = await Promise.all(
        relatedTitles.map(title => getWikipediaExtract(title))
      );
      
      // Combine main content with related content
      const allContent = [mainContent, ...relatedContents]
        .filter(content => content && content.trim().length > 0)
        .join('\n\n');
      
      return allContent || mainContent;
    }
    
    return mainContent;
  } catch (error) {
    console.error('Error fetching related Wikipedia content:', error);
    return null;
  }
}

