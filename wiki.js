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

// Fetch extract plus a lead image thumbnail, for richer myth pages
async function getWikipediaExtractWithImage(wikipediaTitle) {
  try {
    const encodedTitle = encodeURIComponent(wikipediaTitle);
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
      return { extract: null, imageUrl: null };
    }

    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];

    const extract = page?.extract || null;
    const imageUrl = page?.thumbnail?.source || null;

    return { extract, imageUrl };
  } catch (error) {
    console.error('Error fetching Wikipedia extract with image:', error);
    return { extract: null, imageUrl: null };
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

