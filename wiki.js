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
        
        // Query the File page for image metadata with more fields
        const imageInfoUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(cleanFilename)}&prop=imageinfo&iiprop=extmetadata|comment|url&format=json&origin=*`;
        
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
            const imageInfo = imgPage?.imageinfo?.[0];
            
            // Try ImageDescription first (most descriptive)
            if (imageInfo?.extmetadata?.['ImageDescription']?.value) {
              imageCaption = imageInfo.extmetadata['ImageDescription'].value;
            }
            // Try ObjectName (often more specific)
            else if (imageInfo?.extmetadata?.['ObjectName']?.value) {
              imageCaption = imageInfo.extmetadata['ObjectName'].value;
            }
            // Try ShortDescription if available
            else if (imageInfo?.extmetadata?.['ShortDescription']?.value) {
              imageCaption = imageInfo.extmetadata['ShortDescription'].value;
            }
            // Try Artist if it's an artwork
            else if (imageInfo?.extmetadata?.['Artist']?.value && imageInfo?.extmetadata?.['Title']?.value) {
              imageCaption = `${imageInfo.extmetadata['Title'].value} by ${imageInfo.extmetadata['Artist'].value}`;
            }
            // Fallback to comment if available (but usually less descriptive)
            else if (imageInfo?.comment && imageInfo.comment.length > 20) {
              imageCaption = imageInfo.comment;
            }
            
            // Clean up the caption
            if (imageCaption) {
              imageCaption = imageCaption
                // Remove HTML tags
                .replace(/<[^>]*>/g, '')
                // Decode HTML entities
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&nbsp;/g, ' ')
                .replace(/&mdash;/g, '—')
                .replace(/&ndash;/g, '–')
                // Remove "uploaded" dates and related text
                .replace(/uploaded\s+on\s+\d{1,2}\s+\w+\s+\d{4}/gi, '')
                .replace(/uploaded\s+\d{1,2}\s+\w+\s+\d{4}/gi, '')
                .replace(/uploaded:\s*\d{4}-\d{2}-\d{2}/gi, '')
                .replace(/uploaded\s+\d{4}-\d{2}-\d{2}/gi, '')
                .replace(/\(uploaded\s+[^)]+\)/gi, '')
                .replace(/\[uploaded[^\]]+\]/gi, '')
                .replace(/uploaded\s+by\s+[^,]+/gi, '')
                .replace(/uploaded\s+at\s+\d{2}:\d{2}/gi, '')
                // Remove Wikipedia template artifacts
                .replace(/\{\{[^}]+\}\}/g, '')
                .replace(/\[\[([^\]]+)\]\]/g, '$1') // Convert [[link]] to just text
                .replace(/\[\[([^\|]+)\|([^\]]+)\]\]/g, '$2') // Convert [[link|text]] to just text
                // Remove file size and technical metadata
                .replace(/\([0-9,]+\s*(?:×|x)\s*[0-9,]+\s*pixels?\)/gi, '')
                .replace(/\([0-9.]+\s*(?:MB|KB|bytes?)\)/gi, '')
                .replace(/File:[^\s]+/gi, '')
                .replace(/Image:[^\s]+/gi, '')
                // Remove common technical prefixes
                .replace(/^(?:This\s+)?(?:image|photo|picture|illustration|depiction|representation|statue|sculpture|painting|drawing|engraving|relief|mosaic|fresco|carving|artifact|object)\s*(?:of|showing|depicting|representing)?\s*/i, '')
                // Remove redundant phrases
                .replace(/\b(?:see\s+also|see|more\s+info|for\s+more|additional\s+information).*$/i, '')
                .replace(/\b(?:source|credit|attribution|license|copyright).*$/i, '')
                // Fix common spacing issues
                .replace(/\s+/g, ' ')
                .replace(/\s*\.\s*\./g, '.')
                .replace(/\s*,\s*,/g, ',')
                // Remove leading/trailing punctuation issues
                .replace(/^[,\s\.\-:;]+/, '')
                .replace(/[,\s\.\-:;]+$/, '')
                // Capitalize first letter
                .trim();
              
              if (imageCaption && imageCaption.length > 0) {
                imageCaption = imageCaption.charAt(0).toUpperCase() + imageCaption.slice(1);
                
                // Limit caption to 1-2 sentences, but ensure it's meaningful
                const sentences = imageCaption.split(/[.!?]+/).filter(s => s.trim().length > 10); // Only sentences with at least 10 chars
                if (sentences.length > 2) {
                  imageCaption = sentences.slice(0, 2).map(s => s.trim()).join('. ') + '.';
                } else if (sentences.length > 0) {
                  // Ensure it ends with proper punctuation
                  imageCaption = sentences.map(s => s.trim()).join('. ');
                  if (!imageCaption.match(/[.!?]$/)) {
                    imageCaption += '.';
                  }
                }
                
                // Final cleanup - remove if too short or meaningless
                if (imageCaption.length < 15 || /^(?:image|photo|picture|file|upload)/i.test(imageCaption)) {
                  imageCaption = null;
                }
              } else {
                imageCaption = null;
              }
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

