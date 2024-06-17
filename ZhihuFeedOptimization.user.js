// ==UserScript==
// @name        删除知乎首页推送中使用默认头像用户的回答
// @namespace   ZhihuFeedOptimization
// @match       https://www.zhihu.com/
// @grant       none
// @version     0.1-alpha
// @run-at      document-idle
// @author      lisolaris
// @icon        https://www.google.com/s2/favicons?sz=64&domain=zhihu.com
// @description 删掉那些头像都不换就来知乎灌水的用户生产的内容，眼不见心不烦
// ==/UserScript==

(function () {
    'use strict';

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const DEFAULTAVATARHASH = "abed1a8c04700ba7d72b45195223e0ff";

    const userChecked = new Set();
    const cardsToBeDeleted = new Set();

    async function findDefaultAvatarCard(newCards=null) {
        console.log("知乎默认头像卡片移除 检查新获得的推荐卡片列表……");

        var cards;
        if (!newCards) cards = document.getElementsByClassName("Card TopstoryItem TopstoryItem-isRecommend");
        else cards = newCards;

        const fetchPromises = [];
        for (let card of cards) {
            // 每个内容卡片都具有class: "ContentItem ArticleItem"或"ContentItem AnswerItem"
            let cardItem = card.querySelector("div.ContentItem");
            // if (!cardItem) cardItem = card.querySelector("div.ContentItem.ArticleItem");
            // console.log("card: " + card.textContent)

            let extraInfo = JSON.parse(cardItem.getAttribute("data-za-extra-module"));
            let userId = extraInfo.card.content.author_member_hash_id;

            // 此用户已经被检查过/将要检查的卡片已经在待删除列表里 跳过检查
            if (userChecked.has(userId) || cardsToBeDeleted.has(card)) continue;
            else {
                try{
                    // console.log("知乎默认头像卡片移除 查询用户 " + userId);
                    fetchPromises.push(
                        fetch(`https://api.zhihu.com/people/${userId}/profile?profile_new_version=1`)
                            .then(response => response.json())
                            .then(data => {
                                // data.error: 大量请求知乎api后被反爬虫识别 需要到所给出的页面中进行真人验证
                                if (data.error){
                                    alert("知乎默认头像卡片移除 需要进行真人验证，请在打开的窗口中完成！");
                                    window.open(data.error.redirect);
                                }
                                else {
                                    // console.log("用户 " + userId + " 头像URL " + data.avatar_url_template);
                                    if (data.avatar_url_template.toLowerCase().includes(DEFAULTAVATARHASH)){
                                        console.log("待删除列表中加入：" + userId);
                                        cardsToBeDeleted.add(card);
                                    } 
                                    else{
                                        userChecked.add(userId.toLowerCase());
                                    }
                                }
                            })
                            .catch(error => {
                                console.error('发生错误：', error);
                            })
                    );
                }
                catch (e){
                    // console.error(card.textContent);
                    console.error(e);
                }
            }
        }
        await Promise.all(fetchPromises);

        console.log("知乎默认头像卡片移除 完成检查")
        removeCard();
        fetchPromises.length = 0;
    }

    function removeCard() {
        if (cardsToBeDeleted.size > 0) {
            console.log("知乎默认头像卡片移除 开始移除卡片");
            // const cards = document.getElementsByClassName("Card TopstoryItem TopstoryItem-isRecommend");

            for (let card of cardsToBeDeleted){
                let cardItem = card.querySelector("div.ContentItem");
                // if (!cardItem) { cardItem = card.querySelector("div.ContentItem.ArticleItem"); }

                let text = card.querySelector("span.RichText.ztext.CopyrightRichText-richText").textContent;
                const urls = [];
                if (card.querySelectorAll("meta[itemprop='url']").length != 0){
                    for (let url of card.querySelectorAll("meta[itemprop='url']")){
                        urls.push(url.getAttribute("content"));
                    }
                }

                console.log(`%c知乎默认头像卡片移除 已移除卡片: ${cardItem.getAttribute("data-zop")}, 原链接: ${JSON.stringify(urls)}, 预览: ${text}`, "color:#00A2E8");
                card.remove();
            }

            cardsToBeDeleted.clear();
        }
    }

    function showArrayContent() {
        console.log(`toBeDeleted(${cardsToBeDeleted.size}): ` + JSON.stringify(Array.from(cardsToBeDeleted)));
        console.log(`userChecked(${userChecked.size}): ` + JSON.stringify(Array.from(userChecked)));
    }

    // 当检查到推荐流列表发生更新时的回调函数
    // 在新增的卡片超过五个后即将新增的卡片传入findDefaultAvatarCard()对作者头像进行检查
    function checkIsNodeAddedCallback(mutationRecords, observer){
        const newAddedCards = new Set();

        for (let mutation of mutationRecords){
            if (mutation.addedNodes.length != 0){
                if (mutation.addedNodes[0].className === "Card TopstoryItem TopstoryItem-isRecommend")
                    newAddedCards.add(mutation.addedNodes[0]);
            }
        }

        if (newAddedCards.size >= 5){
            findDefaultAvatarCard(Array.from(newAddedCards));
            newAddedCards.clear();
        }
    }

    console.log("知乎默认头像卡片移除 已加载");

    const recomBody = document.querySelector("div.Topstory-recommend");

    if (recomBody) {
        console.log("知乎默认头像卡片移除 在推荐列表变动时检查卡片");
        const obconfig = {attributes: false, childList: true, subtree: true};
        const observer = new MutationObserver(checkIsNodeAddedCallback);
        observer.observe(recomBody, obconfig);

        // console.log("知乎默认头像卡片移除 开始初次检查");
        // sleep(1500);
        // findDefaultAvatarCard();

    }
    // setInterval(showArrayContent, 5000);
})();
