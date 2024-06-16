// ==UserScript==
// @name        删除知乎首页推送中使用默认头像用户的回答
// @namespace   DeleteZhihuDefaultAvatarUserContent
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

    const DEFAULTAVATARHASH = "abed1a8c04700ba7d72b45195223e0ff";
    console.log("知乎默认头像卡片移除 开始运行");

    const userChecked = new Set();
    const toBeDeleted = new Set();

    async function findDefaultAvatarCard() {
        console.log("知乎默认头像卡片移除 检查首页推荐卡片列表……");
        const cards = Array.from(document.getElementsByClassName("Card TopstoryItem TopstoryItem-isRecommend"));

        const fetchPromises = [];

        for (let card of cards) {
            let cardItem = card.querySelector("div.ContentItem.AnswerItem");
            if (!cardItem) { cardItem = card.querySelector("div.ContentItem.ArticleItem"); }
            console.log("card: " + card.textContent)

            let extraInfo = JSON.parse(cardItem.getAttribute("data-za-extra-module"));
            let userId = extraInfo.card.content.author_member_hash_id;

            if (userChecked.has(userId) || toBeDeleted.has(userId)) { continue; }
            else {
                try{
                    // console.log("知乎默认头像卡片移除 查询用户 " + userId);
                    fetchPromises.push(
                        fetch(`https://api.zhihu.com/people/${userId}/profile?profile_new_version=1`)
                            .then(response => response.json())
                            .then(data => {
                                if (data.error) {
                                    window.open(data.error.redirect);
                                } else {
                                    // console.log("用户 " + userId + " 头像URL " + data.avatar_url_template);
                                    if (data.avatar_url_template.toLowerCase().includes(DEFAULTAVATARHASH)) {
                                        console.log("待删除列表中加入：" + userId);
                                        toBeDeleted.add(userId);
                                    } else {
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
                    console.error(card.textContent);
                }
            }
        }

        await Promise.all(fetchPromises);
        console.log("知乎默认头像卡片移除 完成检索")
        removeCard();
        fetchPromises.length = 0;
        cardItemList.length = 0;
    }

    function removeCard() {
        if (toBeDeleted.size > 0) {
            console.log("知乎默认头像卡片移除 开始移除卡片");
            // const cards = document.getElementsByClassName("Card TopstoryItem TopstoryItem-isRecommend");

            for (let cardItem of document.querySelectorAll("div.ContentItem.AnswerItem")) {
                // let cardItem = card.querySelector("div.ContentItem.AnswerItem");
                // if (!cardItem) { cardItem = card.querySelector("div.ContentItem.ArticleItem"); }

                let extraInfo = JSON.parse(cardItem.getAttribute("data-za-extra-module"));
                let userId = extraInfo.card.content.author_member_hash_id;

                // console.log("知乎默认头像卡片移除 解析卡片信息");

                if (toBeDeleted.has(userId)) {
                    let url = cardItem.querySelectorAll("meta[itemprop='url']")[1].getAttribute("content"); 
                    console.log(`知乎默认头像卡片移除 已移除卡片 ${cardItem.getAttribute("data-zop")}, 原链接 ${url}`);
                    card.remove();
                }
            }
            for (let cardItem of document.querySelectorAll("div.ContentItem.ArticleItem")) {
                // let cardItem = card.querySelector("div.ContentItem.AnswerItem");
                // if (!cardItem) { cardItem = card.querySelector("div.ContentItem.ArticleItem"); }

                let extraInfo = JSON.parse(cardItem.getAttribute("data-za-extra-module"));
                let userId = extraInfo.card.content.author_member_hash_id;

                // console.log("知乎默认头像卡片移除 解析卡片信息");

                if (toBeDeleted.has(userId)) {
                    let url = cardItem.querySelectorAll("meta[itemprop='url']")[1].getAttribute("content"); 
                    console.log(`知乎默认头像卡片移除 已移除卡片 ${cardItem.getAttribute("data-zop")}, 原链接 ${url}`);
                    card.remove();
                }
            }
            toBeDeleted.clear();
        }
    }

    function showArrayContent() {
        console.log(`toBeDeleted(${toBeDeleted.size}): ` + JSON.stringify(Array.from(toBeDeleted)));
        console.log(`userChecked(${userChecked.size}): ` + JSON.stringify(Array.from(userChecked)));
    }

    setTimeout(function(){}, 1000);

    const recomBody = document.querySelector(".Topstory-recommend");

    if (recomBody) {
        const obconfig = { attributes: false, childList: true, subtree: true };
        const observer = new MutationObserver(findDefaultAvatarCard);
        observer.observe(recomBody, obconfig);

        console.log("知乎默认头像卡片移除 在推荐列表变动时检查卡片");
    } else {
        console.error("未找到推荐列表的元素");
    }

    // setInterval(showArrayContent, 5000);
})();
