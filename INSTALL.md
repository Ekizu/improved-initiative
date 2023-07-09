# Install

https://computingforgeeks.com/how-to-install-nodejs-on-ubuntu-debian-linux-mint

## Update system
`
sudo apt update
sudo apt -y upgrade
`

## Add Nodejs APT repo
`
sudo apt update
sudo apt -y install curl dirmngr apt-transport-https lsb-release ca-certificates
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
`

## Install Nodejs
`
sudo apt -y install nodejs npm
sudo apt -y install gcc g++ make
`
